import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db, identities, passkeys, sessions } from "../../db";
import { recordActivityLog } from "../../lib/background-events";
import { runInBackground } from "../../lib/background";
import { deleteChallenge, getChallenge } from "../../lib/challenge-store";
import { generateSessionToken, hashSessionToken } from "../../lib/crypto";
import { listIdentitiesForOwner } from "../../lib/identity-serialization";
import { verifyPasskeyAuthentication, type AuthenticatorTransport } from "../../lib/heavy-services";
import { enforceRateLimits, ipRateLimit, subjectRateLimit } from "../../lib/rate-limit";
import { setSessionCookie } from "../../lib/session-cookie";
import { getOrCreateDevice, notifyAccountLoginEvent, type Bindings } from "./shared";

const app = new Hono<{ Bindings: Bindings }>();

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
    const verification = await verifyPasskeyAuthentication(c.env.HEAVY_SERVICES, {
      response: credential,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin,
      expectedRpId: rpId,
      credential: {
        id: passkey.id,
        publicKeyBase64: passkey.publicKey,
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransport[] | undefined,
      },
    });

    if (!verification.verified) {
      return c.json({ error: "Passkey verification failed" }, 400);
    }

    if (!verification.userVerified) {
      return c.json({ error: "Passkey verification failed" }, 400);
    }

    // Update passkey counter
    await db
      .update(passkeys)
      .set({
        counter: verification.newCounter,
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

    runInBackground(c, notifyAccountLoginEvent(
      c.env.HEAVY_SERVICES,
      storedChallenge.userId,
      {
        method: "passkey",
        deviceName: deviceRecord.name,
        deviceType: deviceRecord.type,
      },
      deviceRecord.id,
    ), "Account login notifications");

    // Get user's identities
    const userIdentities = await listIdentitiesForOwner(storedChallenge.userId);

    return c.json({
      success: true,
      device: {
        id: deviceRecord.id,
        name: deviceRecord.name,
        type: deviceRecord.type,
        isNew: deviceRecord.isNew,
      },
      identities: userIdentities,
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

export default app;
