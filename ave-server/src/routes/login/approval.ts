import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db, devices, identities, loginRequests, sessions } from "../../db";
import { recordActivityLog } from "../../lib/background-events";
import { runInBackground } from "../../lib/background";
import { generateSessionToken, hashSessionToken } from "../../lib/crypto";
import { listIdentitiesForOwner } from "../../lib/identity-serialization";
import { enforceRateLimits, ipRateLimit, subjectRateLimit } from "../../lib/rate-limit";
import { setSessionCookie } from "../../lib/session-cookie";
import { sendLoginRequestNotification, type PushSubscription } from "../../lib/webpush";
import {
  getOrCreateDevice,
  notifyAccountLoginEvent,
  notifyLoginRequestInApiApp,
  rejectRequiredEnterpriseSso,
  type Bindings,
} from "./shared";

const app = new Hono<{ Bindings: Bindings }>();

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

  runInBackground(c, (async () => {
    const loginRequest = {
      id: request.id,
      deviceName: request.deviceName,
      deviceType: request.deviceType,
      browser: request.browser,
      os: request.os,
      ipAddress: request.ipAddress,
    };
    const [userDevices] = await Promise.all([
      db
        .select({ id: devices.id, pushSubscription: devices.pushSubscription })
        .from(devices)
        .where(and(eq(devices.userId, identity.userId), eq(devices.isActive, true))),
      notifyLoginRequestInApiApp(c, normalizedHandle, loginRequest),
    ]);
    const invalidDeviceIds = (await Promise.all(userDevices.map(async (userDevice) => {
      if (!userDevice.pushSubscription) return null;
      try {
        const sent = await sendLoginRequestNotification(userDevice.pushSubscription as PushSubscription, {
          requestId: request.id,
          deviceName: request.deviceName || "Unknown Device",
          deviceType: request.deviceType || "computer",
          browser: request.browser || undefined,
          os: request.os || undefined,
          ipAddress: request.ipAddress || undefined,
        });
        return sent ? null : userDevice.id;
      } catch (error) {
        console.error(`[Push] Failed to send notification to device ${userDevice.id}:`, error);
        return null;
      }
    }))).filter((deviceId): deviceId is string => deviceId !== null);

    if (invalidDeviceIds.length) {
      await db
        .update(devices)
        .set({ pushSubscription: null })
        .where(inArray(devices.id, invalidDeviceIds));
    }
  })(), "Login request notifications");

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

    runInBackground(c, notifyAccountLoginEvent(
      identity.userId,
      {
        method: "device_approval",
        deviceName: deviceRecord.name,
        deviceType: deviceRecord.type,
      },
      deviceRecord.id,
    ), "Account login notifications");

    const userIdentities = await listIdentitiesForOwner(identity.userId);

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
      identities: userIdentities,
    });

  }

  if (request.status === "denied") {
    await db.delete(loginRequests).where(eq(loginRequests.id, requestId));
    return c.json({ status: "denied" });
  }

  return c.json({ status: "pending" });
});

export default app;
