import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db, oauthApps, oauthAuthorizations } from "../../db";
import { recordActivityLog } from "../../lib/background-events";
import { validateOpaqueKeyEnvelope } from "../../lib/encryption-key-payload";
import { enforceNativeRateLimits, subjectRateLimit } from "../../lib/rate-limit";
import { requireAuth, requireWritable } from "../../middleware/auth";

const app = new Hono();

const recoverySchema = z.object({
  identityId: z.string().uuid(),
  encryptedAppKey: z.string(),
  confirmRecovery: z.literal(true),
});

app.put(
  "/authorization/:clientId/encryption-key",
  requireAuth,
  requireWritable,
  zValidator("json", recoverySchema),
  async (c) => {
    const user = c.get("user")!;
    const clientId = c.req.param("clientId") || "";
    const { identityId, encryptedAppKey } = c.req.valid("json");
    const envelopeValidation = validateOpaqueKeyEnvelope(encryptedAppKey);
    if (!envelopeValidation.ok) {
      return c.json({ error: envelopeValidation.error }, 400);
    }

    const rateLimitResponse = await enforceNativeRateLimits(c, [{
      binding: "OAUTH_AUTHORIZE_ACTOR_RATE_LIMITER",
      key: `app-key-recovery:${user.id}`,
      periodSeconds: 60,
      fallback: subjectRateLimit("oauth:app-key-recovery:user", user.id, 5, 60 * 1000),
    }]);
    if (rateLimitResponse) return rateLimitResponse;

    const [authorization] = await db
      .select({
        id: oauthAuthorizations.id,
        appId: oauthAuthorizations.appId,
        appName: oauthApps.name,
        appEncryptionMode: oauthAuthorizations.appEncryptionMode,
      })
      .from(oauthAuthorizations)
      .innerJoin(oauthApps, eq(oauthApps.id, oauthAuthorizations.appId))
      .where(and(
        eq(oauthAuthorizations.userId, user.id),
        eq(oauthAuthorizations.identityId, identityId),
        eq(oauthApps.clientId, clientId),
      ))
      .limit(1);

    if (!authorization) {
      return c.json({ error: "Authorization not found" }, 404);
    }
    if (
      authorization.appEncryptionMode &&
      authorization.appEncryptionMode !== "symmetric"
    ) {
      return c.json({ error: "Only symmetric app keys can be recovered with this endpoint" }, 409);
    }

    await db.update(oauthAuthorizations)
      .set({
        encryptedAppKey,
        appPublicKey: null,
        encryptedAppPrivateKey: null,
        appEncryptionMode: "symmetric",
      })
      .where(eq(oauthAuthorizations.id, authorization.id));

    recordActivityLog(c, {
      userId: user.id,
      action: "oauth_app_key_recovered",
      appId: authorization.appId,
      details: {
        appName: authorization.appName,
        appId: authorization.appId,
        identityId,
      },
      deviceId: user.deviceId,
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      severity: "warning",
    });

    return c.json({ success: true as const });
  },
);

export default app;
