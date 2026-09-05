import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db, identities, oauthApps, oauthAuthorizations } from "../../db";
import { appEffectiveSupportsE2ee, isScopeAllowedForApp } from "../../lib/e2ee-scopes";
import { parseOAuthPrompt, requiresAuthorizeInteractionPrompt, wantsAccountPickerPrompt } from "../../lib/oauth-prompt";
import { consumeAuthorizationCode, createAuthorizationCodeWrite, getAuthorizationCode } from "../../lib/oauth-store";
import { getIssuer, signJwt, verifyJwt } from "../../lib/oidc";
import { enforceNativeRateLimits, getClientIp, ipRateLimit, subjectRateLimit } from "../../lib/rate-limit";
import { isOriginAllowedForApp, isRedirectUriAllowedForApp, normalizeRedirectUri } from "../../lib/redirect-uri";
import { requireAuth } from "../../middleware/auth";
import {
  ensureFedCmRequest,
  generateAuthCode,
  getApiBase,
  getWebBase,
  hasAllScopes,
  nowSeconds,
  parseScopes,
  resolveOauthAppForClient,
  setLoginStatusHeader,
} from "./shared";
import { buildTokenResponseFromAuthorizationCode } from "./token-response";

const app = new Hono();

app.get("/fedcm/config", async (c) => {
  c.header("Cache-Control", "public, max-age=300");

  return c.json({
    accounts_endpoint: `${getApiBase()}/api/oauth/fedcm/accounts`,
    id_assertion_endpoint: `${getApiBase()}/api/oauth/fedcm/assertion`,
    client_metadata_endpoint: `${getApiBase()}/api/oauth/fedcm/client-metadata`,
    login_url: `${getWebBase()}/login`,
  });
});

app.get("/fedcm/client-metadata", async (c) => {
  const clientId = c.req.query("client_id") || "";
  const oauthApp = await resolveOauthAppForClient(clientId);

  if (!oauthApp) {
    return c.json({ privacy_policy_url: `${getWebBase()}/privacy`, terms_of_service_url: `${getWebBase()}/terms` });
  }

  let appOrigin: string | null = null;
  try {
    appOrigin = oauthApp.websiteUrl ? new URL(oauthApp.websiteUrl).origin : null;
  } catch {
    appOrigin = null;
  }

  return c.json({
    privacy_policy_url: appOrigin ? `${appOrigin}/privacy` : `${getWebBase()}/privacy`,
    terms_of_service_url: appOrigin ? `${appOrigin}/terms` : `${getWebBase()}/terms`,
  });
});

app.get("/fedcm/accounts", async (c) => {
  const fedcmError = ensureFedCmRequest(c);
  if (fedcmError) return fedcmError;

  const user = c.get("user");
  if (!user) {
    setLoginStatusHeader(c, "logged-out");
    return c.json({ accounts: [] }, 401);
  }

  setLoginStatusHeader(c, "logged-in");

  const [userIdentities, authorizations] = await Promise.all([
    db
      .select()
      .from(identities)
      .where(eq(identities.userId, user.id)),
    db
      .select({
        identityId: oauthAuthorizations.identityId,
        clientId: oauthApps.clientId,
      })
      .from(oauthAuthorizations)
      .innerJoin(oauthApps, eq(oauthAuthorizations.appId, oauthApps.id))
      .where(eq(oauthAuthorizations.userId, user.id)),
  ]);

  const approvedClientsByIdentity = new Map<string, string[]>();
  for (const authorization of authorizations) {
    const existing = approvedClientsByIdentity.get(authorization.identityId) || [];
    existing.push(authorization.clientId);
    approvedClientsByIdentity.set(authorization.identityId, existing);
  }

  return c.json({
    accounts: userIdentities.map((identity) => ({
      id: identity.id,
      given_name: identity.displayName.split(" ")[0] || identity.displayName,
      name: identity.displayName,
      ...(identity.email ? { email: identity.email } : {}),
      picture: identity.avatarUrl || undefined,
      approved_clients: approvedClientsByIdentity.get(identity.id) || [],
      login_hints: [identity.handle, identity.id],
    })),
  });
});

app.post("/fedcm/assertion", async (c) => {
  const fedcmError = ensureFedCmRequest(c);
  if (fedcmError) return fedcmError;

  const user = c.get("user");
  if (!user) {
    setLoginStatusHeader(c, "logged-out");
    return c.json({ error: { code: "access_denied", url: `${getWebBase()}/login` } }, 401);
  }

  setLoginStatusHeader(c, "logged-in");

  const form = await c.req.parseBody();
  const clientId = String(form.client_id || "");
  const accountId = String(form.account_id || "");
  const origin = c.req.header("Origin") || "";
  const rawParams = String(form.params || "");
  const rateLimitResponse = await enforceNativeRateLimits(c, [
    {
      binding: "OAUTH_AUTHORIZE_ACTOR_RATE_LIMITER",
      key: `fedcm:ip:${getClientIp(c)}`,
      periodSeconds: 60,
      fallback: ipRateLimit(c, "oauth:fedcm-assertion:ip", 120, 60 * 1000),
    },
    {
      binding: "OAUTH_AUTHORIZE_ACTOR_RATE_LIMITER",
      key: `fedcm:user:${user.id}`,
      periodSeconds: 60,
      fallback: subjectRateLimit("oauth:fedcm-assertion:user", user.id, 120, 60 * 1000),
    },
    {
      binding: "OAUTH_AUTHORIZE_ACTOR_RATE_LIMITER",
      key: `fedcm:client:${clientId}`,
      periodSeconds: 60,
      fallback: subjectRateLimit("oauth:fedcm-assertion:client", clientId, 120, 60 * 1000),
    },
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  let extraParams: Record<string, unknown> = {};
  if (rawParams) {
    try {
      extraParams = JSON.parse(rawParams);
    } catch {
      return c.json({ error: { code: "invalid_request", url: `${getWebBase()}/docs` } }, 400);
    }
  }

  const redirectUri = typeof extraParams.redirectUri === "string" ? normalizeRedirectUri(extraParams.redirectUri) : "";
  const scope = typeof extraParams.scope === "string" ? extraParams.scope : "openid profile email";
  const state = typeof extraParams.state === "string" ? extraParams.state : "";
  const nonce = typeof extraParams.nonce === "string" ? extraParams.nonce : undefined;
  const promptRaw = typeof extraParams.prompt === "string" ? extraParams.prompt : "";
  const oauthPrompts = parseOAuthPrompt(promptRaw);
  const forceAuthorizeInteraction = requiresAuthorizeInteractionPrompt(oauthPrompts);

  const oauthApp = await resolveOauthAppForClient(clientId);
  if (!oauthApp) {
    return c.json({ error: { code: "unauthorized_client", url: `${getWebBase()}/docs` } }, 400);
  }

  if (!origin || !isOriginAllowedForApp(oauthApp, origin)) {
    return c.json({ error: { code: "access_denied", url: `${getWebBase()}/docs` } }, 403);
  }

  if (!redirectUri || !isRedirectUriAllowedForApp(oauthApp, redirectUri)) {
    return c.json({ error: { code: "invalid_request", url: `${getWebBase()}/docs` } }, 400);
  }

  const requestedScopes = parseScopes(scope);
  if (requestedScopes.some((requested) => !isScopeAllowedForApp(requested, oauthApp.allowedScopes || []))) {
    return c.json({ error: { code: "invalid_scope", url: `${getWebBase()}/docs` } }, 400);
  }

  const [authorizationContext] = await db
    .select({ identity: identities, authorization: oauthAuthorizations })
    .from(identities)
    .leftJoin(oauthAuthorizations, and(
      eq(oauthAuthorizations.userId, user.id),
      eq(oauthAuthorizations.appId, oauthApp.id),
      eq(oauthAuthorizations.identityId, identities.id),
    ))
    .where(and(eq(identities.id, accountId), eq(identities.userId, user.id)))
    .limit(1);
  const identity = authorizationContext?.identity;
  const existingAuth = authorizationContext?.authorization;

  if (!identity) {
    return c.json({ error: { code: "access_denied", url: `${getWebBase()}/login` } }, 403);
  }

  const requiresScopeConsent = !existingAuth || !hasAllScopes(existingAuth.scope, scope);

  if (
    forceAuthorizeInteraction
    || (parseScopes(scope).includes("email") && !identity.email)
    || appEffectiveSupportsE2ee(oauthApp)
    || requiresScopeConsent
  ) {
    const continueUrl = new URL(`${getWebBase()}/signin`);
    continueUrl.searchParams.set("client_id", clientId);
    continueUrl.searchParams.set("redirect_uri", redirectUri);
    continueUrl.searchParams.set("scope", scope);
    if (state) continueUrl.searchParams.set("state", state);
    if (nonce) continueUrl.searchParams.set("nonce", nonce);
    if (requiresScopeConsent) {
      continueUrl.searchParams.set("prompt", [...new Set([...oauthPrompts.filter((value) => value !== "none"), "consent"])].join(" "));
    } else if (promptRaw) {
      continueUrl.searchParams.set("prompt", promptRaw);
    }
    if (!wantsAccountPickerPrompt(oauthPrompts)) {
      continueUrl.searchParams.set("identity_id", identity.id);
    }
    continueUrl.searchParams.set("fedcm_continue", "1");

    return c.json({ continue_on: continueUrl.toString() });
  }

  const code = generateAuthCode();
  const authorizationCodeWrite = createAuthorizationCodeWrite(code, {
    authorizationId: existingAuth.id,
    userId: user.id,
    appId: oauthApp.id,
    identityId: identity.id,
    redirectUri,
    scope,
    nonce,
    encryptedAppKey: existingAuth.encryptedAppKey || undefined,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const [assertion] = await Promise.all([
    signJwt({
      iss: getIssuer(),
      aud: clientId,
      sub: identity.id,
      typ: "ave_fedcm",
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      state: state || undefined,
      nonce,
      exp: nowSeconds() + 5 * 60,
      iat: nowSeconds(),
    }),
    authorizationCodeWrite,
  ]);

  return c.json({ token: assertion });
});
app.post("/fedcm/finalize", requireAuth, zValidator("json", z.object({
  code: z.string(),
  clientId: z.string(),
  state: z.string().optional(),
  appKey: z.string().optional(),
  appPublicKey: z.string().optional(),
  appPrivateKey: z.string().optional(),
  appKeyOld: z.string().optional(),
  appPublicKeyOld: z.string().optional(),
  appPrivateKeyOld: z.string().optional(),
  appKeyReset: z.boolean().optional(),
})), async (c) => {
  const user = c.get("user")!;
  const {
    code,
    clientId,
    state,
    appKey,
    appPublicKey,
    appPrivateKey,
    appKeyOld,
    appPublicKeyOld,
    appPrivateKeyOld,
    appKeyReset,
  } = c.req.valid("json");
  const rateLimitResponse = await enforceNativeRateLimits(c, [
    {
      binding: "OAUTH_AUTHORIZE_ACTOR_RATE_LIMITER",
      key: `fedcm-finalize:ip:${getClientIp(c)}`,
      periodSeconds: 60,
      fallback: ipRateLimit(c, "oauth:fedcm-finalize:ip", 120, 60 * 1000),
    },
    {
      binding: "OAUTH_AUTHORIZE_ACTOR_RATE_LIMITER",
      key: `fedcm-finalize:user:${user.id}`,
      periodSeconds: 60,
      fallback: subjectRateLimit("oauth:fedcm-finalize:user", user.id, 120, 60 * 1000),
    },
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  const authCodeResult = await getAuthorizationCode(code);
  if (!authCodeResult.value) {
    return c.json({ error: "invalid_grant" }, 400);
  }

  const authCode = authCodeResult.value;
  if (!authCode.authorizationId) return c.json({ error: "invalid_grant" }, 400);
  if (authCode.userId !== user.id) {
    return c.json({ error: "access_denied" }, 403);
  }

  const oauthApp = await resolveOauthAppForClient(clientId);
  if (!oauthApp || oauthApp.id !== authCode.appId) {
    return c.json({ error: "invalid_client" }, 400);
  }

  const assertion = await signJwt({
    iss: getIssuer(),
    aud: clientId,
    sub: authCode.identityId,
    typ: "ave_fedcm",
    code,
    app_key: appKey || undefined,
    app_public_key: appPublicKey || undefined,
    app_private_key: appPrivateKey || undefined,
    app_key_old: appKeyOld || undefined,
    app_public_key_old: appPublicKeyOld || undefined,
    app_private_key_old: appPrivateKeyOld || undefined,
    app_key_reset: appKeyReset ? true : undefined,
    client_id: clientId,
    redirect_uri: authCode.redirectUri,
    state: state || undefined,
    nonce: authCode.nonce,
    exp: nowSeconds() + 5 * 60,
    iat: nowSeconds(),
  });

  return c.json({ assertion });
});

app.post("/fedcm/exchange", zValidator("json", z.object({
  assertion: z.string(),
  clientId: z.string(),
})), async (c) => {
  const { assertion, clientId } = c.req.valid("json");
  const rateLimitResponse = await enforceNativeRateLimits(c, [
    {
      binding: "OAUTH_AUTHORIZE_ACTOR_RATE_LIMITER",
      key: `fedcm-exchange:ip:${getClientIp(c)}`,
      periodSeconds: 60,
      fallback: ipRateLimit(c, "oauth:fedcm-exchange:ip", 120, 60 * 1000),
    },
    {
      binding: "OAUTH_AUTHORIZE_ACTOR_RATE_LIMITER",
      key: `fedcm-exchange:client:${clientId}`,
      periodSeconds: 60,
      fallback: subjectRateLimit("oauth:fedcm-exchange:client", clientId, 120, 60 * 1000),
    },
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  const assertionPayload = await verifyJwt(assertion, clientId);

  if (!assertionPayload || assertionPayload.typ !== "ave_fedcm") {
    return c.json({ error: "invalid_grant", error_description: "Invalid FedCM assertion" }, 400);
  }

  if (String(assertionPayload.client_id || "") !== clientId) {
    return c.json({ error: "invalid_client", error_description: "Client mismatch" }, 400);
  }

  const code = String(assertionPayload.code || "");
  const redirectUri = String(assertionPayload.redirect_uri || "");
  if (!code || !redirectUri) {
    return c.json({ error: "invalid_request", error_description: "Malformed FedCM assertion" }, 400);
  }

  const oauthApp = await resolveOauthAppForClient(clientId);
  if (!oauthApp) {
    return c.json({ error: "invalid_client", error_description: "Client not found" }, 400);
  }

  const authCodeResult = await consumeAuthorizationCode(code);
  if (!authCodeResult.value) {
    return c.json({
      error: "invalid_grant",
      error_description: authCodeResult.expired ? "Authorization code expired" : "Authorization code not found",
    }, 400);
  }

  const authCode = authCodeResult.value;
  if (authCode.redirectUri !== redirectUri || authCode.appId !== oauthApp.id) {
    return c.json({ error: "invalid_grant", error_description: "FedCM assertion does not match authorization" }, 400);
  }
  if (!authCode.authorizationId) return c.json({ error: "invalid_grant" }, 400);
  if (parseScopes(authCode.scope).some((scope) => !isScopeAllowedForApp(scope, oauthApp.allowedScopes || []))) {
    return c.json({ error: "invalid_scope" }, 400);
  }

  const response = await buildTokenResponseFromAuthorizationCode({
    authCode,
    oauthApp,
    clientId,
    redirectUri,
    includeEncryptedAppKey: true,
  });

  return c.json(response);
});

export default app;
