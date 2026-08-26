import { zValidator } from "@hono/zod-validator";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db, devices, identities, passkeys, sessions } from "../../db";
import { recordActivityLog } from "../../lib/background-events";
import { setChallenge } from "../../lib/challenge-store";
import { generateSessionToken, hashSessionToken } from "../../lib/crypto";
import { isDemoHandle, isDemoLoginEnabled, verifyDemoPassword } from "../../lib/demo-auth";
import { listIdentitiesForOwner } from "../../lib/identity-serialization";
import { generatePasskeyAuthenticationOptions } from "../../lib/heavy-services";
import { enforceRateLimits, ipRateLimit, subjectRateLimit } from "../../lib/rate-limit";
import { setSessionCookie } from "../../lib/session-cookie";
import { getOrCreateDevice, rejectRequiredEnterpriseSso, type Bindings } from "./shared";

const app = new Hono<{ Bindings: Bindings }>();

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

    authOptions = await generatePasskeyAuthenticationOptions(c.env.HEAVY_SERVICES, {
      rpId,
      allowCredentials: [],
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

  const userIdentities = await listIdentitiesForOwner(identity.userId);

  return c.json({
    success: true,
    device: {
      id: deviceRecord.id,
      name: deviceRecord.name,
      type: deviceRecord.type,
      isNew: deviceRecord.isNew,
    },
    identities: userIdentities,
    readOnly: true,
  });
});

export default app;
