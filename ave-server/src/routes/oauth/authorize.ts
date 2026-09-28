import { zValidator } from "@hono/zod-validator";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  db,
  identities,
  oauthApps,
  oauthAuthorizations,
} from "../../db";
import { buildE2eeAuthUpdate, validateE2eeAuthPayload } from "../../lib/identity/app-e2ee-auth";
import { recordActivityLog } from "../../lib/platform/background-events";
import {
  isImplementedE2eeMode,
  isScopeAllowedForApp,
  resolveRequestedE2eeModeConflict,
} from "../../lib/identity/e2ee-scopes";
import { hasVerifiedEmail } from "../../lib/identity/identity-serialization";
import { createAuthorizationCodeWrite } from "../../lib/oauth/oauth-store";
import { enforceNativeRateLimits, getClientIp, ipRateLimit, subjectRateLimit } from "../../lib/platform/rate-limit";
import { isRedirectUriAllowedForApp, normalizeRedirectUri } from "../../lib/oauth/redirect-uri";
import { requireAuth } from "../../middleware/auth";
import { generateAuthCode, parseScopes } from "./shared";

const app = new Hono();

// Authorization endpoint - user grants access
app.post("/authorize", requireAuth, zValidator("json", z.object({
  clientId: z.string(),
  redirectUri: z.string().transform(normalizeRedirectUri).pipe(z.string().url()),
  scope: z.string().optional().default("profile"),
  state: z.string().optional(),
  identityId: z.string().uuid(),
  codeChallenge: z.string().optional(), // PKCE
  codeChallengeMethod: z.enum(["S256", "plain"]).optional(),
  encryptedAppKey: z.string().optional(),
  appPublicKey: z.string().optional(),
  encryptedAppPrivateKey: z.string().optional(),
  nonce: z.string().optional(),
  interactionMode: z.enum(["instant", "prompt"]).optional().default("prompt"),
})), async (c) => {
  const user = c.get("user")!;
  const {
    clientId,
    redirectUri,
    scope,
    state,
    identityId,
    codeChallenge,
    codeChallengeMethod,
    encryptedAppKey,
    appPublicKey,
    encryptedAppPrivateKey,
    nonce,
    interactionMode,
  } = c.req.valid("json");
  const rateLimitResponse = await enforceNativeRateLimits(c, [
    {
      binding: "OAUTH_AUTHORIZE_ACTOR_RATE_LIMITER",
      key: `ip:${getClientIp(c)}`,
      periodSeconds: 60,
      fallback: ipRateLimit(c, "oauth:authorize:ip", 120, 60 * 1000),
    },
    {
      binding: "OAUTH_AUTHORIZE_ACTOR_RATE_LIMITER",
      key: `user:${user.id}`,
      periodSeconds: 60,
      fallback: subjectRateLimit("oauth:authorize:user", user.id, 120, 60 * 1000),
    },
    {
      binding: "OAUTH_CLIENT_RATE_LIMITER",
      key: `authorize:${clientId}`,
      periodSeconds: 60,
      fallback: subjectRateLimit("oauth:authorize:client", clientId, 180, 60 * 1000),
    },
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  const [authorizationContext] = await db
    .select({
      oauthApp: oauthApps,
      identity: identities,
      authorization: oauthAuthorizations,
    })
    .from(oauthApps)
    .leftJoin(identities, and(
      eq(identities.id, identityId),
      eq(identities.userId, user.id),
    ))
    .leftJoin(oauthAuthorizations, and(
      eq(oauthAuthorizations.userId, user.id),
      eq(oauthAuthorizations.appId, oauthApps.id),
      eq(oauthAuthorizations.identityId, identityId),
    ))
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);

  if (!authorizationContext) {
    return c.json({ error: "Invalid client_id" }, 400);
  }
  const { oauthApp, identity } = authorizationContext;
  let existingAuth = authorizationContext.authorization;

  if (!isRedirectUriAllowedForApp(oauthApp, redirectUri)) {
    return c.json({ error: "Invalid redirect_uri" }, 400);
  }

  const requestedScopes = parseScopes(scope);
  const allowedScopes = (oauthApp.allowedScopes || []) as string[];
  const invalidScopes = requestedScopes.filter(
    (s) => !isScopeAllowedForApp(s, allowedScopes),
  );
  if (invalidScopes.length > 0) {
    return c.json({ error: "invalid_scope", error_description: `Invalid scopes: ${invalidScopes.join(", ")}` }, 400);
  }

  if (!identity) {
    return c.json({ error: "Invalid identity" }, 400);
  }

  if (requestedScopes.includes("email") && !hasVerifiedEmail(identity)) {
    return c.json({
      error: identity.pendingEmail
        ? "Verify your email before continuing"
        : "Add a verified email before continuing",
    }, 409);
  }

  const authorizationMethod = interactionMode === "instant"
    ? "instant"
    : user.authMethod === "passkey"
      ? "passkey"
      : user.authMethod === "trust_code" || user.authMethod === "device_approval"
      ? "fallback"
      : user.authMethod || "unknown";

  let authorizationId = existingAuth?.id;
  let authorizationUpdate: {
    id: string;
    e2ee: ReturnType<typeof buildE2eeAuthUpdate>;
  } | null = null;
  const { mode: requestedE2eeMode, conflict: e2eeModeConflict, reset: e2eeReset } =
    resolveRequestedE2eeModeConflict(requestedScopes, existingAuth);
  if (e2eeModeConflict) {
    return c.json({
      error: "invalid_scope",
      error_description: "Request only one E2EE encryption mode per authorization",
    }, 400);
  }
  if (e2eeReset && !requestedE2eeMode) {
    return c.json({
      error: "invalid_scope",
      error_description: "e2ee:reset requires an encryption mode or an existing app encryption setup",
    }, 400);
  }
  if (requestedE2eeMode && !isImplementedE2eeMode(requestedE2eeMode)) {
    return c.json({
      error: "unsupported_encryption_mode",
      error_description: `Encryption mode "${requestedE2eeMode}" is not available yet`,
    }, 400);
  }

  const e2eePayload = {
    encryptedAppKey,
    appPublicKey,
    encryptedAppPrivateKey,
  };

  if (requestedE2eeMode) {
    const validationError = validateE2eeAuthPayload(
      requestedE2eeMode,
      e2eePayload,
      existingAuth,
      { reset: e2eeReset },
    );
    if (validationError) {
      return c.json({ error: validationError }, 400);
    }
  }

  const e2eeUpdate = requestedE2eeMode
    ? buildE2eeAuthUpdate(requestedE2eeMode, e2eePayload, existingAuth, { reset: e2eeReset })
    : {};

  if (!existingAuth) {
    const inserted = await db.insert(oauthAuthorizations).values({
      scope: requestedScopes.join(" "),
      userId: user.id,
      appId: oauthApp.id,
      identityId,
      lastAuthorizedAt: new Date(),
      authorizationCount: 1,
      lastAuthMethod: authorizationMethod,
      encryptedAppKey: e2eeUpdate.encryptedAppKey ?? null,
      appPublicKey: e2eeUpdate.appPublicKey ?? null,
      encryptedAppPrivateKey: e2eeUpdate.encryptedAppPrivateKey ?? null,
      appEncryptionMode: e2eeUpdate.appEncryptionMode ?? null,
    })
      .onConflictDoNothing({
        target: [oauthAuthorizations.userId, oauthAuthorizations.appId, oauthAuthorizations.identityId],
      })
      .returning({ id: oauthAuthorizations.id });
    authorizationId = inserted[0]?.id;

    if (!authorizationId) {
      const [concurrentAuthorization] = await db
        .select()
        .from(oauthAuthorizations)
        .where(and(
          eq(oauthAuthorizations.userId, user.id),
          eq(oauthAuthorizations.appId, oauthApp.id),
          eq(oauthAuthorizations.identityId, identityId),
        ))
        .limit(1);

      if (!concurrentAuthorization) {
        return c.json({
          error: "authorization_conflict",
          error_description: "The authorization changed while it was being created. Please try again.",
        }, 409);
      }

      if (requestedE2eeMode) {
        const validationError = validateE2eeAuthPayload(
          requestedE2eeMode,
          e2eePayload,
          concurrentAuthorization,
          { reset: e2eeReset },
        );
        if (validationError) {
          return c.json({
            error: "authorization_conflict",
            error_description: `${validationError}. Reload the authorization and try again.`,
          }, 409);
        }
      }

      existingAuth = concurrentAuthorization;
      authorizationId = concurrentAuthorization.id;
      authorizationUpdate = {
        id: concurrentAuthorization.id,
        e2ee: requestedE2eeMode
          ? buildE2eeAuthUpdate(
            requestedE2eeMode,
            e2eePayload,
            concurrentAuthorization,
            { reset: e2eeReset },
          )
          : {},
      };
    }
  } else {
    authorizationUpdate = {
      id: existingAuth.id,
      e2ee: e2eeUpdate,
    };
  }

  // Generate authorization code
  const code = generateAuthCode();

  // Get the encrypted app key to include in the auth code
  // Either from the new authorization or from an existing one
  const finalEncryptedAppKey = (
    e2eeReset
      ? encryptedAppKey
      : existingAuth?.encryptedAppKey || encryptedAppKey
  ) || undefined;
  const finalAppPublicKey = (
    e2eeReset
      ? appPublicKey
      : existingAuth?.appPublicKey || appPublicKey
  ) || undefined;
  const finalEncryptedAppPrivateKey =
    (e2eeReset
      ? encryptedAppPrivateKey
      : existingAuth?.encryptedAppPrivateKey || encryptedAppPrivateKey) || undefined;
  const finalAppEncryptionMode = requestedE2eeMode || existingAuth?.appEncryptionMode || undefined;

  const authorizationCodeWrite = createAuthorizationCodeWrite(code, {
    authorizationId,
    userId: user.id,
    appId: oauthApp.id,
    identityId,
    redirectUri,
    scope,
    expiresAt: Date.now() + 10 * 60 * 1000,
    codeChallenge,
    codeChallengeMethod,
    encryptedAppKey: finalEncryptedAppKey,
    appPublicKey: finalAppPublicKey,
    encryptedAppPrivateKey: finalEncryptedAppPrivateKey,
    appEncryptionMode: finalAppEncryptionMode,
    nonce: nonce || undefined,
  });

  if (authorizationUpdate) {
    await db.batch([
      db.update(oauthAuthorizations)
        .set({
          ...authorizationUpdate.e2ee,
          scope: [...new Set([...parseScopes(existingAuth?.scope || ""), ...requestedScopes])].join(" "),
          lastAuthorizedAt: new Date(),
          authorizationCount: sql`${oauthAuthorizations.authorizationCount} + 1`,
          lastAuthMethod: authorizationMethod,
        })
        .where(eq(oauthAuthorizations.id, authorizationUpdate.id)),
      authorizationCodeWrite,
    ]);
  } else {
    await authorizationCodeWrite;
  }

  // Log activity
  recordActivityLog(c, {
    userId: user.id,
    action: "oauth_authorized",
    appId: oauthApp.id,
    details: {
      appName: oauthApp.name,
      appId: oauthApp.id,
      identityId,
      authMethod: authorizationMethod,
      scope,
    },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  // Build redirect URL with code
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  return c.json({ redirectUrl: redirectUrl.toString() });
});

export default app;
