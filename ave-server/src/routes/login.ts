import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { db, users, identities, passkeys, devices, sessions, loginRequests, trustCodes } from "../db";
import { 
  generateSessionToken, 
  hashSessionToken,
  generateChallenge,
  verifyTrustCode,
} from "../lib/crypto";
import { clearSessionCookie, setSessionCookie, SESSION_COOKIE_NAME } from "../lib/session-cookie";
import { eq, and, gt, desc, isNull, sql } from "drizzle-orm";
import { sendLoginRequestNotification, sendAccountEventNotification, type PushSubscription } from "../lib/webpush";
import { deleteChallenge, getChallenge, setChallenge } from "../lib/challenge-store";
import { serializeIdentityForOwner } from "../lib/identity-serialization";
import { isDemoHandle, isDemoLoginEnabled, verifyDemoPassword } from "../lib/demo-auth";
import { enforceRateLimits, ipRateLimit, subjectRateLimit } from "../lib/rate-limit";
import { getRequiredEnterpriseSsoForEmail } from "../lib/enterprise-sso-policy";
import { recordActivityLog } from "../lib/background-events";

type Bindings = {
  API_APP: DurableObjectNamespace;
  INTERNAL_API_TOKEN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

async function notifyLoginRequestInApiApp(
  c: { env: Bindings },
  handle: string,
  request: {
    id: string;
    deviceName: string | null;
    deviceType: string | null;
    browser: string | null;
    os: string | null;
    ipAddress: string | null;
  },
) {
  const id = c.env.API_APP.idFromName("primary");
  const stub = c.env.API_APP.get(id);
  const headers = new Headers({ "Content-Type": "application/json" });
  if (c.env.INTERNAL_API_TOKEN) {
    headers.set("x-internal-token", c.env.INTERNAL_API_TOKEN);
  }

  const response = await stub.fetch("https://internal.aveid.net/__internal/login-request", {
    method: "POST",
    headers,
    body: JSON.stringify({ handle, request }),
  });

  if (!response.ok) {
    console.warn("Login request notification failed:", response.status, await response.text());
  }
}

async function rejectRequiredEnterpriseSso(c: any, identity: { email: string | null }) {
  const sso = await getRequiredEnterpriseSsoForEmail(identity.email);
  if (!sso) return null;
  return c.json({
    error: "Enterprise SSO is required for this identity. Sign in with your work email.",
    ssoRequired: true,
    loginUrl: sso.loginUrl,
    organization: sso.organization,
  }, 403);
}

async function getUnusedTrustCodes(userId: string) {
  return db
    .select()
    .from(trustCodes)
    .where(and(eq(trustCodes.userId, userId), isNull(trustCodes.usedAt)));
}

async function findUnusedTrustCode(userId: string, code: string) {
  const userTrustCodes = await getUnusedTrustCodes(userId);
  let matchedCode: (typeof userTrustCodes)[number] | null = null;

  for (const trustCode of userTrustCodes) {
    if (verifyTrustCode(code, trustCode.codeHash)) {
      matchedCode = trustCode;
      break;
    }
  }

  if (!matchedCode) {
    return {
      matchedCode: null,
      availableCodes: userTrustCodes.length,
    };
  }

  return {
    matchedCode,
    availableCodes: userTrustCodes.length,
  };
}

async function claimTrustCode(userId: string, trustCodeId: string): Promise<number | null> {
  const claimed = await db
    .update(trustCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(trustCodes.id, trustCodeId), eq(trustCodes.userId, userId), isNull(trustCodes.usedAt)))
    .returning({ id: trustCodes.id });

  if (!claimed.length) return null;

  const remainingCodes = await getUnusedTrustCodes(userId);
  return remainingCodes.length;
}

/**
 * Get or create a device for a user
 * Uses fingerprint (stored in client localStorage) to uniquely identify devices
 * Falls back to creating new device if no fingerprint match
 */
async function getOrCreateDevice(
  userId: string,
  deviceInfo: { name: string; type: string; browser?: string; os?: string; fingerprint?: string }
): Promise<{ id: string; name: string; type: string; isNew: boolean }> {
  // Try to find an existing device with the same fingerprint
  if (deviceInfo.fingerprint) {
    const [existingDevice] = await db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.userId, userId),
          eq(devices.fingerprint, deviceInfo.fingerprint)
        )
      )
      .limit(1);
    
    if (existingDevice) {
      // Update last seen, device info (in case browser was updated), and return existing device
      await db
        .update(devices)
        .set({ 
          lastSeenAt: new Date(), 
          isActive: true,
          // Update name/browser/os in case they changed (e.g., browser update)
          name: deviceInfo.name,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
        })
        .where(eq(devices.id, existingDevice.id));
      
      return {
        id: existingDevice.id,
        name: deviceInfo.name, // Return updated name
        type: existingDevice.type,
        isNew: false,
      };
    }
  }
  
  // Create new device
  const [newDevice] = await db
    .insert(devices)
    .values({
      userId,
      name: deviceInfo.name,
      type: deviceInfo.type,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      fingerprint: deviceInfo.fingerprint,
    })
    .returning();
  
  return {
    id: newDevice.id,
    name: newDevice.name,
    type: newDevice.type,
    isNew: true,
  };
}

async function notifyAccountLoginEvent(
  userId: string,
  event: {
    method: "passkey" | "device_approval" | "trust_code";
    deviceName: string;
    deviceType: string;
  },
  excludeDeviceId?: string | null
): Promise<void> {
  const userDevices = await db
    .select()
    .from(devices)
    .where(and(eq(devices.userId, userId), eq(devices.isActive, true)));

  for (const userDevice of userDevices) {
    if (excludeDeviceId && userDevice.id === excludeDeviceId) {
      continue;
    }

    if (!userDevice.pushSubscription) {
      continue;
    }

    try {
      const subscription = userDevice.pushSubscription as PushSubscription;
      const sent = await sendAccountEventNotification(subscription, {
        title: "New Login",
        body: `${event.deviceName} signed in to your Ave account`,
        event: "login",
        url: "/dashboard?section=activity",
        details: {
          method: event.method,
          deviceType: event.deviceType,
        },
      });

      if (!sent) {
        await db
          .update(devices)
          .set({ pushSubscription: null })
          .where(eq(devices.id, userDevice.id));
      }
    } catch (error) {
      console.error(`[Push] Failed to send account event to device ${userDevice.id}:`, error);
    }
  }
}

// Start login - find user by handle and return options
app.post("/start", zValidator("json", z.object({
  handle: z.string().min(3).max(32),
})), async (c) => {
  const { handle } = c.req.valid("json");
  const normalizedHandle = handle.toLowerCase();
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "login:start:ip", 60, 60 * 1000, { failClosed: true }),
    subjectRateLimit("login:start:handle", normalizedHandle, 20, 5 * 60 * 1000, { failClosed: true }),
  ]);
  if (rateLimitResponse) return rateLimitResponse;
  
  const [identity] = await db
    .select({
      id: identities.id,
      userId: identities.userId,
      displayName: identities.displayName,
      handle: identities.handle,
      avatarUrl: identities.avatarUrl,
      email: identities.email,
    })
    .from(identities)
    .where(eq(identities.handle, normalizedHandle))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Account not found" }, 404);
  }

  const ssoRequired = await rejectRequiredEnterpriseSso(c, identity);
  if (ssoRequired) return ssoRequired;

  const demoPasswordEnabled = isDemoHandle(normalizedHandle) && isDemoLoginEnabled();

  if (demoPasswordEnabled) {
    return c.json({
      userId: identity.userId,
      identity: {
        id: identity.id,
        displayName: identity.displayName,
        handle: identity.handle,
        avatarUrl: identity.avatarUrl,
      },
      hasDevices: false,
      hasPasskeys: false,
      demoPasswordEnabled: true,
      authOptions: null,
      authSessionId: null,
    });
  }

  const [[deviceCount], [passkeyCount]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(devices)
      .where(and(eq(devices.userId, identity.userId), eq(devices.isActive, true))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(passkeys)
      .where(eq(passkeys.userId, identity.userId)),
  ]);

  const hasDevices = Number(deviceCount?.count || 0) > 0;
  const hasPasskeys = Number(passkeyCount?.count || 0) > 0;
  const rpId = process.env.RP_ID || "localhost";
  
  let authOptions = null;
  let authSessionId = null;
  
  if (hasPasskeys) {
    authSessionId = crypto.randomUUID();
    
    authOptions = await generateAuthenticationOptions({
      rpID: rpId,
      allowCredentials: [],
      userVerification: "required",
    });
    
    await setChallenge(
      "login-auth",
      authSessionId,
      {
        challenge: authOptions.challenge,
        userId: identity.userId,
      },
      10 * 60 * 1000
    );
  }
  
  return c.json({
    userId: identity.userId,
    identity: {
      id: identity.id,
      displayName: identity.displayName,
      handle: identity.handle,
      avatarUrl: identity.avatarUrl,
    },
    hasDevices,
    hasPasskeys,
    demoPasswordEnabled: false,
    authOptions,
    authSessionId,
  });
});

app.post("/demo", zValidator("json", z.object({
  handle: z.string().min(3).max(32),
  password: z.string().min(1).max(256),
  device: z.object({
    name: z.string().max(64),
    type: z.enum(["phone", "computer", "tablet"]),
    browser: z.string().optional(),
    os: z.string().optional(),
    fingerprint: z.string().max(64).optional(),
  }),
})), async (c) => {
  const { handle, password, device } = c.req.valid("json");
  const normalizedHandle = handle.toLowerCase();
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "login:demo:ip", 8, 60 * 1000, { failClosed: true }),
    subjectRateLimit("login:demo:handle", normalizedHandle, 8, 15 * 60 * 1000, { failClosed: true }),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  if (!isDemoLoginEnabled() || !isDemoHandle(normalizedHandle)) {
    return c.json({ error: "Demo login is not available" }, 403);
  }

  if (!verifyDemoPassword(password)) {
    return c.json({ error: "Invalid demo password" }, 401);
  }

  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.handle, normalizedHandle))
    .limit(1);

  if (!identity) {
    return c.json({ error: "Demo account not found" }, 404);
  }

  const deviceRecord = await getOrCreateDevice(identity.userId, device);
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    userId: identity.userId,
    deviceId: deviceRecord.id,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    authMethod: "demo",
  });

  setSessionCookie(c, sessionToken, expiresAt);
  c.header("Set-Login", "logged-in");

  recordActivityLog(c, {
    userId: identity.userId,
    action: "login",
    details: { method: "demo", deviceName: deviceRecord.name, isNewDevice: deviceRecord.isNew },
    deviceId: deviceRecord.id,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, identity.userId));

  return c.json({
    success: true,
    device: {
      id: deviceRecord.id,
      name: deviceRecord.name,
      type: deviceRecord.type,
      isNew: deviceRecord.isNew,
    },
    identities: userIdentities.map(serializeIdentityForOwner),
    readOnly: true,
  });
});

// Login with passkey
app.post("/passkey", zValidator("json", z.object({
  authSessionId: z.string().uuid(),
  credential: z.any(),
  device: z.object({
    name: z.string().max(64),
    type: z.enum(["phone", "computer", "tablet"]),
    browser: z.string().optional(),
    os: z.string().optional(),
    fingerprint: z.string().max(64).optional(),
  }),
})), async (c) => {
  const { authSessionId, credential, device } = c.req.valid("json");
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "login:passkey:ip", 30, 60 * 1000, { failClosed: true }),
    subjectRateLimit("login:passkey:session", authSessionId, 10, 10 * 60 * 1000, { failClosed: true }),
  ]);
  if (rateLimitResponse) return rateLimitResponse;
  
  const storedChallenge = await getChallenge<{ challenge: string; userId: string }>(
    "login-auth",
    authSessionId
  );
  if (!storedChallenge) {
    return c.json({ error: "Login session expired" }, 400);
  }
  
  // Find the passkey
  const [passkey] = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.id, credential.id))
    .limit(1);
  
  if (!passkey) {
    return c.json({ error: "Passkey not recognized. It may have been registered on a different device or browser." }, 400);
  }
  
  if (passkey.userId !== storedChallenge.userId) {
    return c.json({ error: "Passkey does not belong to this account" }, 400);
  }
  
  const rpId = process.env.RP_ID || "localhost";
  // For development, accept any localhost origin
  const configuredOrigin = process.env.RP_ORIGIN || "http://localhost:5173";
  const clientOrigin = credential.response?.clientDataJSON 
    ? JSON.parse(Buffer.from(credential.response.clientDataJSON, "base64").toString()).origin
    : configuredOrigin;
  
  // In development, allow any localhost port
  const expectedOrigin = clientOrigin && clientOrigin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)
    ? clientOrigin 
    : configuredOrigin;
  
  try {
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin,
      expectedRPID: rpId,
      credential: {
        id: passkey.id,
        publicKey: Buffer.from(passkey.publicKey, "base64"),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransportFuture[] | undefined,
      },
    });
    
    if (!verification.verified) {
      return c.json({ error: "Passkey verification failed" }, 400);
    }

    if ((verification.authenticationInfo as { userVerified?: boolean }).userVerified === false) {
      return c.json({ error: "Passkey verification failed" }, 400);
    }
    
    // Update passkey counter
    await db
      .update(passkeys)
      .set({ 
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      })
      .where(eq(passkeys.id, passkey.id));
    
    await deleteChallenge("login-auth", authSessionId);
    
    // Get or create device (reuses existing device if browser/OS matches)
    const deviceRecord = await getOrCreateDevice(storedChallenge.userId, device);
    
    // Create session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.insert(sessions).values({
        userId: storedChallenge.userId,
        deviceId: deviceRecord.id,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt,
        ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
        userAgent: c.req.header("user-agent"),
        authMethod: "passkey",
      });

    setSessionCookie(c, sessionToken, expiresAt);
    c.header("Set-Login", "logged-in");
    
    // Log activity
    recordActivityLog(c, {
      userId: storedChallenge.userId,
      action: "login",
      details: { method: "passkey", deviceName: deviceRecord.name, isNewDevice: deviceRecord.isNew },
      deviceId: deviceRecord.id,
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      severity: "info",
    });

    await notifyAccountLoginEvent(
      storedChallenge.userId,
      {
        method: "passkey",
        deviceName: deviceRecord.name,
        deviceType: deviceRecord.type,
      },
      deviceRecord.id
    );
    
    // Get user's identities
    const userIdentities = await db
      .select()
      .from(identities)
      .where(eq(identities.userId, storedChallenge.userId));
    
    return c.json({
      success: true,
      device: {
        id: deviceRecord.id,
        name: deviceRecord.name,
        type: deviceRecord.type,
        isNew: deviceRecord.isNew,
      },
      identities: userIdentities.map(serializeIdentityForOwner),
      // PRF-encrypted master key (if this passkey has one stored)
      // Client can use this to decrypt master key if PRF output is available
      prfEncryptedMasterKey: passkey.prfEncryptedMasterKey,
      // Flag indicating whether master key recovery is needed
      // If PRF is available, client can decrypt without trust codes
      needsMasterKey: !passkey.prfEncryptedMasterKey,
    });
  } catch (error) {
    console.error("Passkey verification error:", error);
    return c.json({ error: "Passkey verification failed" }, 400);
  }
});

// Request login approval from another device
app.post("/request-approval", zValidator("json", z.object({
  handle: z.string().min(3).max(32),
  requesterPublicKey: z.string(), // Ephemeral public key for E2EE key exchange
  device: z.object({
    name: z.string().max(64),
    type: z.enum(["phone", "computer", "tablet"]),
    browser: z.string().optional(),
    os: z.string().optional(),
    fingerprint: z.string().max(64).optional(),
  }),
})), async (c) => {
  const { handle, requesterPublicKey, device } = c.req.valid("json");
  const normalizedHandle = handle.toLowerCase();
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "login:approval:ip", 10, 60 * 1000, { failClosed: true }),
    subjectRateLimit("login:approval:handle", normalizedHandle, 6, 5 * 60 * 1000, { failClosed: true }),
  ]);
  if (rateLimitResponse) return rateLimitResponse;
  
  // Find identity by handle
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.handle, normalizedHandle))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Account not found" }, 404);
  }

  const ssoRequired = await rejectRequiredEnterpriseSso(c, identity);
  if (ssoRequired) return ssoRequired;
  
  // Create login request
  const [request] = await db
    .insert(loginRequests)
    .values({
      handle: normalizedHandle,
      deviceName: device.name,
      deviceType: device.type,
      browser: device.browser,
      os: device.os,
      fingerprint: device.fingerprint,
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      requesterPublicKey,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    })
    .returning();
  
  // Notify user's connected devices via WebSocket
  await notifyLoginRequestInApiApp(c, normalizedHandle, {
    id: request.id,
    deviceName: request.deviceName,
    deviceType: request.deviceType,
    browser: request.browser,
    os: request.os,
    ipAddress: request.ipAddress,
  });
  
  // Send push notifications to all user's devices with push subscriptions
  const userDevices = await db
    .select()
    .from(devices)
    .where(and(eq(devices.userId, identity.userId), eq(devices.isActive, true)));
  
  for (const userDevice of userDevices) {
    if (userDevice.pushSubscription) {
      try {
        const subscription = userDevice.pushSubscription as PushSubscription;
        const sent = await sendLoginRequestNotification(subscription, {
          requestId: request.id,
          deviceName: request.deviceName || "Unknown Device",
          deviceType: request.deviceType || "computer",
          browser: request.browser || undefined,
          os: request.os || undefined,
          ipAddress: request.ipAddress || undefined,
        });
        
        // If push failed (subscription invalid), remove it
        if (!sent) {
          await db
            .update(devices)
            .set({ pushSubscription: null })
            .where(eq(devices.id, userDevice.id));
        }
      } catch (e) {
        console.error(`[Push] Failed to send notification to device ${userDevice.id}:`, e);
      }
    }
  }
  
  return c.json({
    requestId: request.id,
    expiresAt: request.expiresAt,
  });
});

// Check login request status (polling endpoint)
app.get("/request-status/:requestId", async (c) => {
  const requestId = c.req.param("requestId");
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "login:status:ip", 180, 60 * 1000, { failClosed: true }),
    subjectRateLimit("login:status:request", requestId, 180, 60 * 1000, { failClosed: true }),
  ]);
  if (rateLimitResponse) return rateLimitResponse;
  
  const [request] = await db
    .select()
    .from(loginRequests)
    .where(eq(loginRequests.id, requestId))
    .limit(1);
  
  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }
  
  if (new Date() > request.expiresAt) {
    return c.json({ status: "expired" });
  }

  if (request.status === "consumed") {
    return c.json({ status: "pending" });
  }
  
  if (request.status === "approved" && request.encryptedMasterKey) {
    if (!request.approverPublicKey) {
      return c.json({ error: "Approval key missing" }, 400);
    }

    const [claimed] = await db
      .update(loginRequests)
      .set({ status: "consumed" })
      .where(and(
        eq(loginRequests.id, requestId),
        eq(loginRequests.status, "approved"),
      ))
      .returning();

    if (!claimed) {
      return c.json({ status: "pending" });
    }

    const [identity] = await db
      .select()
      .from(identities)
      .where(eq(identities.handle, claimed.handle))
      .limit(1);
    
    if (!identity) {
      return c.json({ error: "Account not found" }, 404);
    }

    const ssoRequired = await rejectRequiredEnterpriseSso(c, identity);
    if (ssoRequired) return ssoRequired;
    
    const deviceRecord = await getOrCreateDevice(identity.userId, {
      name: claimed.deviceName || "Unknown Device",
      type: claimed.deviceType || "computer",
      browser: claimed.browser || undefined,
      os: claimed.os || undefined,
      fingerprint: claimed.fingerprint || undefined,
    });
    
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(sessions).values({
      userId: identity.userId,
      deviceId: deviceRecord.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt,
      ipAddress: claimed.ipAddress,
      userAgent: c.req.header("user-agent"),
      authMethod: "device_approval",
    });

    setSessionCookie(c, sessionToken, expiresAt);
    c.header("Set-Login", "logged-in");
    
    recordActivityLog(c, {
      userId: identity.userId,
      action: "login",
      details: { method: "device_approval", deviceName: deviceRecord.name, isNewDevice: deviceRecord.isNew },
      deviceId: deviceRecord.id,
      ipAddress: claimed.ipAddress,
      severity: "info",
    });

    await notifyAccountLoginEvent(
      identity.userId,
      {
        method: "device_approval",
        deviceName: deviceRecord.name,
        deviceType: deviceRecord.type,
      },
      deviceRecord.id
    );
    
    const userIdentities = await db
      .select()
      .from(identities)
      .where(eq(identities.userId, identity.userId));

    await db.delete(loginRequests).where(eq(loginRequests.id, requestId));
    
    return c.json({
      status: "approved",
      encryptedMasterKey: claimed.encryptedMasterKey,
      approverPublicKey: claimed.approverPublicKey,
      device: {
        id: deviceRecord.id,
        name: deviceRecord.name,
        type: deviceRecord.type,
        isNew: deviceRecord.isNew,
      },
      identities: userIdentities.map(serializeIdentityForOwner),
    });

  }
  
  if (request.status === "denied") {
    await db.delete(loginRequests).where(eq(loginRequests.id, requestId));
    return c.json({ status: "denied" });
  }
  
  return c.json({ status: "pending" });
});

// Login with trust code (recovery)
app.post("/trust-code", zValidator("json", z.object({
  handle: z.string().min(3).max(32),
  code: z.string(),
  device: z.object({
    name: z.string().max(64),
    type: z.enum(["phone", "computer", "tablet"]),
    browser: z.string().optional(),
    os: z.string().optional(),
    fingerprint: z.string().max(64).optional(),
  }),
})), async (c) => {
  const { handle, code, device } = c.req.valid("json");
  const normalizedHandle = handle.toLowerCase();
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "login:trust-code:ip", 5, 15 * 60 * 1000, { failClosed: true }),
    subjectRateLimit("login:trust-code:handle", normalizedHandle, 5, 30 * 60 * 1000, { failClosed: true }),
  ]);
  if (rateLimitResponse) return rateLimitResponse;
  
  // Find identity by handle
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.handle, normalizedHandle))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Account not found" }, 404);
  }

  const ssoRequired = await rejectRequiredEnterpriseSso(c, identity);
  if (ssoRequired) return ssoRequired;
  
  const { matchedCode, availableCodes } = await findUnusedTrustCode(identity.userId, code);

  if (availableCodes === 0) {
    return c.json({ 
      error: "No recovery codes are available for your account. Set them up from Security on a signed-in device." 
    }, 400);
  }

  if (!matchedCode) {
    recordActivityLog(c, {
      userId: identity.userId,
      action: "trust_code_failed",
      details: { reason: "invalid_code", trustCodesCount: availableCodes },
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      severity: "warning",
    });
    
    return c.json({ 
      error: `That recovery code is invalid or already used. ${availableCodes} recovery code(s) remaining.` 
    }, 400);
  }

  const remainingCodes = await claimTrustCode(identity.userId, matchedCode.id);
  if (remainingCodes === null) {
    return c.json({
      error: `That recovery code is invalid or already used. ${Math.max(availableCodes - 1, 0)} recovery code(s) remaining.`,
    }, 400);
  }
  
  // Get user for encrypted master key backup
  const [user] = await db
    .select({ encryptedMasterKeyBackup: users.encryptedMasterKeyBackup })
    .from(users)
    .where(eq(users.id, identity.userId))
    .limit(1);
  
  // Get or create device (reuses existing device if browser/OS matches)
  const deviceRecord = await getOrCreateDevice(identity.userId, device);
  
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    userId: identity.userId,
    deviceId: deviceRecord.id,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    authMethod: "trust_code",
  });

  setSessionCookie(c, sessionToken, expiresAt);
  c.header("Set-Login", "logged-in");
  
  // Log activity
  recordActivityLog(c, {
    userId: identity.userId,
    action: "login",
    details: { method: "trust_code", deviceName: deviceRecord.name, isNewDevice: deviceRecord.isNew },
    deviceId: deviceRecord.id,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning", // Trust code usage is noteworthy
  });

  await notifyAccountLoginEvent(
    identity.userId,
    {
      method: "trust_code",
      deviceName: deviceRecord.name,
      deviceType: deviceRecord.type,
    },
    deviceRecord.id
  );
  
  // Get user's identities
  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, identity.userId));

  recordActivityLog(c, {
    userId: identity.userId,
    action: "trust_code_used",
    details: { remainingCodes },
    deviceId: deviceRecord.id,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });
  
  return c.json({
    success: true,
    // Return the encrypted master key backup - client will decrypt with the trust code
    encryptedMasterKeyBackup: user?.encryptedMasterKeyBackup,
    device: {
      id: deviceRecord.id,
      name: deviceRecord.name,
      type: deviceRecord.type,
      isNew: deviceRecord.isNew,
    },
    identities: userIdentities.map(serializeIdentityForOwner),
    remainingTrustCodes: remainingCodes,
    remainingRecoveryCodes: remainingCodes,
  });
});

// Recover master key - verify trust code and return encrypted backup without creating session
// Used when user logged in via passkey on a new device but doesn't have the master key locally
app.post("/recover-key", zValidator("json", z.object({
  handle: z.string().min(3).max(32),
  code: z.string(),
})), async (c) => {
  const { handle, code } = c.req.valid("json");
  const normalizedHandle = handle.toLowerCase();
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "login:recover-key:ip", 5, 15 * 60 * 1000, { failClosed: true }),
    subjectRateLimit("login:recover-key:handle", normalizedHandle, 5, 30 * 60 * 1000, { failClosed: true }),
  ]);
  if (rateLimitResponse) return rateLimitResponse;
  
  // Find identity by handle
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.handle, normalizedHandle))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Account not found" }, 404);
  }

  const ssoRequired = await rejectRequiredEnterpriseSso(c, identity);
  if (ssoRequired) return ssoRequired;
  
  const { matchedCode, availableCodes } = await findUnusedTrustCode(identity.userId, code);

  if (availableCodes === 0) {
    return c.json({ 
      error: "No recovery codes are available for your account." 
    }, 400);
  }

  if (!matchedCode) {
    recordActivityLog(c, {
      userId: identity.userId,
      action: "key_recovery_failed",
      details: { reason: "invalid_code", trustCodesCount: availableCodes },
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      severity: "warning",
    });
    
    return c.json({ error: `That recovery code is invalid or already used. ${availableCodes} recovery code(s) remaining.` }, 400);
  }

  const remainingCodes = await claimTrustCode(identity.userId, matchedCode.id);
  if (remainingCodes === null) {
    return c.json({
      error: `That recovery code is invalid or already used. ${Math.max(availableCodes - 1, 0)} recovery code(s) remaining.`,
    }, 400);
  }
  
  // Get user for encrypted master key backup
  const [user] = await db
    .select({ encryptedMasterKeyBackup: users.encryptedMasterKeyBackup })
    .from(users)
    .where(eq(users.id, identity.userId))
    .limit(1);
  
  if (!user?.encryptedMasterKeyBackup) {
    return c.json({ error: "No encryption backup found." }, 400);
  }
  
  // Log successful key recovery
  recordActivityLog(c, {
    userId: identity.userId,
    action: "key_recovery",
    details: { method: "trust_code" },
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });

  recordActivityLog(c, {
    userId: identity.userId,
    action: "trust_code_used",
    details: { remainingCodes, context: "key_recovery" },
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });
  
  return c.json({
    success: true,
    encryptedMasterKeyBackup: user.encryptedMasterKeyBackup,
    remainingTrustCodes: remainingCodes,
    remainingRecoveryCodes: remainingCodes,
  });
});

// Logout
app.post("/logout", async (c) => {
  const authHeader = c.req.header("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const cookieHeader = c.req.header("Cookie") || "";
  const cookieToken = cookieHeader
    ? cookieHeader
        .split(";")
        .map((p) => p.trim())
        .find((p) => p.startsWith(`${SESSION_COOKIE_NAME}=`))
        ?.slice(`${SESSION_COOKIE_NAME}=`.length)
    : null;

  const token = bearerToken || (cookieToken ? decodeURIComponent(cookieToken) : null);

  if (token) {
    const tokenHash = hashSessionToken(token);
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  clearSessionCookie(c);
  c.header("Set-Login", "logged-out");
  return c.json({ success: true });
});

export default app;
