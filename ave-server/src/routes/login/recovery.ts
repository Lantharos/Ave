import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db, identities, sessions, users } from "../../db";
import { runInBackground } from "../../lib/background";
import { recordActivityLog } from "../../lib/background-events";
import { generateSessionToken, hashSessionToken } from "../../lib/crypto";
import { listIdentitiesForOwner } from "../../lib/identity-serialization";
import { enforceRateLimits, ipRateLimit, subjectRateLimit } from "../../lib/rate-limit";
import { setSessionCookie } from "../../lib/session-cookie";
import {
  claimTrustCode,
  findUnusedTrustCode,
  getOrCreateDevice,
  notifyAccountLoginEvent,
  rejectRequiredEnterpriseSso,
  type Bindings,
} from "./shared";

const app = new Hono<{ Bindings: Bindings }>();

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

  runInBackground(c, notifyAccountLoginEvent(
    c.env.HEAVY_SERVICES,
    identity.userId,
    {
      method: "trust_code",
      deviceName: deviceRecord.name,
      deviceType: deviceRecord.type,
    },
    deviceRecord.id,
  ), "Account login notifications");

  // Get user's identities
  const userIdentities = await listIdentitiesForOwner(identity.userId);

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
    identities: userIdentities,
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

  // Get user for encrypted master key backup
  const [user] = await db
    .select({ encryptedMasterKeyBackup: users.encryptedMasterKeyBackup })
    .from(users)
    .where(eq(users.id, identity.userId))
    .limit(1);

  if (!user?.encryptedMasterKeyBackup) {
    return c.json({ error: "No encryption backup found." }, 400);
  }

  const remainingCodes = await claimTrustCode(identity.userId, matchedCode.id);
  if (remainingCodes === null) {
    return c.json({
      error: `That recovery code is invalid or already used. ${Math.max(availableCodes - 1, 0)} recovery code(s) remaining.`,
    }, 400);
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
    identityId: identity.id,
    encryptedMasterKeyBackup: user.encryptedMasterKeyBackup,
    remainingTrustCodes: remainingCodes,
    remainingRecoveryCodes: remainingCodes,
  });
});

export default app;
