import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { db, users, identities, passkeys, devices, sessions, loginRequests, trustCodes, activityLogs } from "../db";
import { 
  generateSessionToken, 
  hashSessionToken,
  generateChallenge,
  verifyTrustCode,
  hashTrustCode,
} from "../lib/crypto";
import { clearSessionCookie, setSessionCookie, SESSION_COOKIE_NAME } from "../lib/session-cookie";
import { eq, and, gt, desc } from "drizzle-orm";
import { notifyLoginRequest } from "../lib/websocket";
import { sendLoginRequestNotification, type PushSubscription } from "../lib/webpush";
import { deleteChallenge, getChallenge, setChallenge } from "../lib/challenge-store";

const app = new Hono();

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

// Start login - find user by handle and return options
app.post("/start", zValidator("json", z.object({
  handle: z.string().min(3).max(32),
})), async (c) => {
  const { handle } = c.req.valid("json");
  
  // Find identity by handle
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.handle, handle.toLowerCase()))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Account not found" }, 404);
  }
  
  // Check if user has trusted devices (for device approval option)
  const userDevices = await db
    .select()
    .from(devices)
    .where(and(eq(devices.userId, identity.userId), eq(devices.isActive, true)));
  
  // Get passkeys for WebAuthn
  const userPasskeys = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.userId, identity.userId));
  
  const rpId = process.env.RP_ID || "localhost";
  
  // Generate auth options if user has passkeys
  let authOptions = null;
  let authSessionId = null;
  
  if (userPasskeys.length > 0) {
    authSessionId = crypto.randomUUID();
    
    authOptions = await generateAuthenticationOptions({
      rpID: rpId,
      // Don't restrict to specific credentials - allow discoverable credentials
      // This helps with password managers like 1Password
      allowCredentials: [],
      userVerification: "preferred",
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
    hasDevices: userDevices.length > 0,
    hasPasskeys: userPasskeys.length > 0,
    authOptions,
    authSessionId,
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
    console.log(`Passkey not found for credential ID: ${credential.id}`);
    console.log(`Looking for user ${storedChallenge.userId}`);
    
    // Try to find any passkey for this user to help with debugging
    const userPasskeys = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.userId, storedChallenge.userId));
    
    console.log(`User has ${userPasskeys.length} passkey(s) registered`);
    if (userPasskeys.length > 0) {
      console.log(`Registered passkey IDs:`, userPasskeys.map(pk => pk.id));
    }
    
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
        transports: passkey.transports as AuthenticatorTransport[] | undefined,
      },
    });
    
    if (!verification.verified) {
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
    });

    setSessionCookie(c, sessionToken, expiresAt);
    
    // Log activity
    await db.insert(activityLogs).values({
      userId: storedChallenge.userId,
      action: "login",
      details: { method: "passkey", deviceName: deviceRecord.name, isNewDevice: deviceRecord.isNew },
      deviceId: deviceRecord.id,
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      severity: "info",
    });
    
    // Get user's identities
    const userIdentities = await db
      .select()
      .from(identities)
      .where(eq(identities.userId, storedChallenge.userId));
    
    return c.json({
      success: true,
      sessionToken,
      device: {
        id: deviceRecord.id,
        name: deviceRecord.name,
        type: deviceRecord.type,
      },
      identities: userIdentities.map((i) => ({
        id: i.id,
        displayName: i.displayName,
        handle: i.handle,
        email: i.email,
        avatarUrl: i.avatarUrl,
        bannerUrl: i.bannerUrl,
        isPrimary: i.isPrimary,
      })),
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
  
  // Find identity by handle
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.handle, handle.toLowerCase()))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Account not found" }, 404);
  }
  
  // Create login request
  const [request] = await db
    .insert(loginRequests)
    .values({
      handle: handle.toLowerCase(),
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
  notifyLoginRequest(handle.toLowerCase(), {
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
  
  if (request.status === "approved" && request.encryptedMasterKey) {
    if (!request.approverPublicKey) {
      return c.json({ error: "Approval key missing" }, 400);
    }

    // Login approved! Return the encrypted master key
    // The requesting device can decrypt this with its private ephemeral key
    
    // Find identity for session creation
    const [identity] = await db
      .select()
      .from(identities)
      .where(eq(identities.handle, request.handle))
      .limit(1);
    
    if (!identity) {
      return c.json({ error: "Account not found" }, 404);
    }
    
    // Get or create device (reuses existing device if fingerprint matches)
    const deviceRecord = await getOrCreateDevice(identity.userId, {
      name: request.deviceName || "Unknown Device",
      type: request.deviceType || "computer",
      browser: request.browser || undefined,
      os: request.os || undefined,
      fingerprint: request.fingerprint || undefined,
    });
    
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(sessions).values({
      userId: identity.userId,
      deviceId: deviceRecord.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt,
      ipAddress: request.ipAddress,
      userAgent: c.req.header("user-agent"),
    });

    setSessionCookie(c, sessionToken, expiresAt);
    
    // Log activity
    await db.insert(activityLogs).values({
      userId: identity.userId,
      action: "login",
      details: { method: "device_approval", deviceName: deviceRecord.name, isNewDevice: deviceRecord.isNew },
      deviceId: deviceRecord.id,
      ipAddress: request.ipAddress,
      severity: "info",
    });
    
    // Get user's identities
    const userIdentities = await db
      .select()
      .from(identities)
      .where(eq(identities.userId, identity.userId));
    
    // Delete the login request
    await db.delete(loginRequests).where(eq(loginRequests.id, requestId));
    
    return c.json({
      status: "approved",
      sessionToken,
      encryptedMasterKey: request.encryptedMasterKey,
      approverPublicKey: request.approverPublicKey,
      device: {
        id: deviceRecord.id,
        name: deviceRecord.name,
        type: deviceRecord.type,
      },
      identities: userIdentities.map((i) => ({
        id: i.id,
        displayName: i.displayName,
        handle: i.handle,
        email: i.email,
        avatarUrl: i.avatarUrl,
        bannerUrl: i.bannerUrl,
        isPrimary: i.isPrimary,
      })),
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
  
  // Find identity by handle
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.handle, handle.toLowerCase()))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Account not found" }, 404);
  }
  
  // Find and verify trust code
  const userTrustCodes = await db
    .select()
    .from(trustCodes)
    .where(eq(trustCodes.userId, identity.userId));
  
  console.log(`[Trust Code Login] User ${identity.handle} (${identity.userId})`);
  console.log(`[Trust Code Login] Found ${userTrustCodes.length} trust code(s) in database`);
  console.log(`[Trust Code Login] Provided code: ${code}`);
  console.log(`[Trust Code Login] Provided code hash: ${hashTrustCode(code)}`);
  
  if (userTrustCodes.length === 0) {
    console.log(`[Trust Code Login] ERROR: No trust codes found for this user!`);
    return c.json({ 
      error: `No trust codes found for your account. You may need to regenerate them from the Security page.` 
    }, 400);
  }
  
  let matchedCode = null;
  for (const tc of userTrustCodes) {
    console.log(`[Trust Code Login] Checking code ${tc.id.substring(0, 8)}... stored hash: ${tc.codeHash}`);
    const matches = verifyTrustCode(code, tc.codeHash);
    console.log(`[Trust Code Login] Matches: ${matches}`);
    if (matches) {
      matchedCode = tc;
      break;
    }
  }
  
  if (!matchedCode) {
    console.log(`[Trust Code Login] ERROR: None of the ${userTrustCodes.length} code(s) matched!`);
    // Log failed attempt
    await db.insert(activityLogs).values({
      userId: identity.userId,
      action: "trust_code_failed",
      details: { reason: "invalid_code", trustCodesCount: userTrustCodes.length },
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      severity: "warning",
    });
    
    return c.json({ 
      error: `Invalid trust code. You have ${userTrustCodes.length} trust code(s) registered.` 
    }, 400);
  }
  
  console.log(`[Trust Code Login] SUCCESS: Matched code ${matchedCode.id.substring(0, 8)}`);
  
  // Don't mark code as used - trust codes are reusable
  // This allows users to use the same code multiple times
  
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
  });

  setSessionCookie(c, sessionToken, expiresAt);
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: identity.userId,
    action: "login",
    details: { method: "trust_code", deviceName: deviceRecord.name, isNewDevice: deviceRecord.isNew },
    deviceId: deviceRecord.id,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning", // Trust code usage is noteworthy
  });
  
  // Get user's identities
  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, identity.userId));
  
  // Count remaining codes (all codes, since they're reusable)
  const remainingCodes = await db
    .select()
    .from(trustCodes)
    .where(eq(trustCodes.userId, identity.userId));
  
  return c.json({
    success: true,
    sessionToken,
    // Return the encrypted master key backup - client will decrypt with the trust code
    encryptedMasterKeyBackup: user?.encryptedMasterKeyBackup,
    device: {
      id: deviceRecord.id,
      name: deviceRecord.name,
      type: deviceRecord.type,
    },
    identities: userIdentities.map((i) => ({
      id: i.id,
      displayName: i.displayName,
      handle: i.handle,
      email: i.email,
      avatarUrl: i.avatarUrl,
      bannerUrl: i.bannerUrl,
      isPrimary: i.isPrimary,
    })),
    remainingTrustCodes: remainingCodes.length,
  });
});

// Recover master key - verify trust code and return encrypted backup without creating session
// Used when user logged in via passkey on a new device but doesn't have the master key locally
app.post("/recover-key", zValidator("json", z.object({
  handle: z.string().min(3).max(32),
  code: z.string(),
})), async (c) => {
  const { handle, code } = c.req.valid("json");
  
  // Find identity by handle
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.handle, handle.toLowerCase()))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Account not found" }, 404);
  }
  
  // Find and verify trust code
  const userTrustCodes = await db
    .select()
    .from(trustCodes)
    .where(eq(trustCodes.userId, identity.userId));
  
  if (userTrustCodes.length === 0) {
    return c.json({ 
      error: "No trust codes found for your account." 
    }, 400);
  }
  
  let matchedCode = null;
  for (const tc of userTrustCodes) {
    if (verifyTrustCode(code, tc.codeHash)) {
      matchedCode = tc;
      break;
    }
  }
  
  if (!matchedCode) {
    // Log failed attempt
    await db.insert(activityLogs).values({
      userId: identity.userId,
      action: "key_recovery_failed",
      details: { reason: "invalid_code" },
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      severity: "warning",
    });
    
    return c.json({ error: "Invalid trust code." }, 400);
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
  await db.insert(activityLogs).values({
    userId: identity.userId,
    action: "key_recovery",
    details: { method: "trust_code" },
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });
  
  return c.json({
    success: true,
    encryptedMasterKeyBackup: user.encryptedMasterKeyBackup,
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
  return c.json({ success: true });
});

export default app;
