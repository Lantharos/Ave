import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, oauthApps, oauthAuthorizations, oauthRefreshTokens, identities, activityLogs, appAnalyticsEvents, oauthResources, oauthDelegationGrants, oauthDelegationAuditLogs } from "../db";
import { requireAuth } from "../middleware/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { randomUUID, timingSafeEqual } from "crypto";
import { hashSessionToken } from "../lib/crypto";
import { getIssuer, getResourceAudience, getJwtPublicJwk, signJwt, verifyJwt, hashToken } from "../lib/oidc";
import { consumeAuthorizationCode, getAccessToken, getAuthorizationCode, setAccessToken, setAuthorizationCode } from "../lib/oauth-store";

const app = new Hono();
export const oidcRoutes = new Hono();

oidcRoutes.get("/webfinger", (c) => {
  const resource = c.req.query("resource");
  if (!resource) {
    return c.json({ error: "resource required" }, 400);
  }

  return c.json({
    subject: resource,
    links: [
      {
        rel: "http://openid.net/specs/connect/1.0/issuer",
        href: getIssuer(),
      },
    ],
  });
});

function getDiscoveryBase(): string {
  return process.env.OIDC_DISCOVERY_BASE || "https://api.aveid.net";
}

// Generate authorization code
function generateAuthCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

// Generate opaque access token
function generateAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function isValidPkceCodeVerifier(value: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  const maxLength = Math.max(aBuffer.length, bBuffer.length);
  const paddedA = Buffer.alloc(maxLength);
  const paddedB = Buffer.alloc(maxLength);
  aBuffer.copy(paddedA);
  bBuffer.copy(paddedB);
  const lengthMismatch = aBuffer.length ^ bBuffer.length;
  return timingSafeEqual(paddedA, paddedB) && lengthMismatch === 0;
}

// Generate refresh token
function generateRefreshToken(): string {
  return `rt_${randomUUID().replace(/-/g, "")}`;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function parseScopes(scope: string): string[] {
  return scope.split(" ").map((s) => s.trim()).filter(Boolean);
}

function getWebBase(): string {
  return process.env.RP_ORIGIN || "https://aveid.net";
}

function getApiBase(): string {
  return process.env.OIDC_DISCOVERY_BASE || "https://api.aveid.net";
}

function hasScope(scope: string, requested: string): boolean {
  return parseScopes(scope).includes(requested);
}

function hasAllScopes(grantedScope: string, requestedScope: string): boolean {
  const granted = new Set(parseScopes(grantedScope));
  return parseScopes(requestedScope).every((scope) => granted.has(scope));
}

function ensureFedCmRequest(c: any): Response | null {
  const destination = c.req.header("Sec-Fetch-Dest");
  if (destination !== "webidentity") {
    return c.json({ error: "invalid_request", error_description: "FedCM requests must include Sec-Fetch-Dest: webidentity" }, 400);
  }
  return null;
}

function setLoginStatusHeader(c: any, status: "logged-in" | "logged-out") {
  c.header("Set-Login", status);
}

async function resolveOauthAppForClient(clientId: string) {
  if (isQuickClient(clientId)) {
    return null;
  }

  const [app] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);

  return app ?? null;
}

function isAllowedClientOriginForApp(oauthApp: typeof oauthApps.$inferSelect, origin: string): boolean {
  const allowedOrigins = new Set<string>();

  for (const redirectUri of (oauthApp.redirectUris || []) as string[]) {
    try {
      allowedOrigins.add(new URL(redirectUri).origin);
    } catch {
    }
  }

  if (oauthApp.websiteUrl) {
    try {
      allowedOrigins.add(new URL(oauthApp.websiteUrl).origin);
    } catch {
    }
  }

  return allowedOrigins.has(origin);
}

async function issueAuthorizationCodeForApp(params: {
  userId: string;
  appId: string;
  identityId: string;
  redirectUri: string;
  scope: string;
  nonce?: string;
  encryptedAppKey?: string;
}) {
  const code = generateAuthCode();

  await setAuthorizationCode(code, {
    userId: params.userId,
    appId: params.appId,
    identityId: params.identityId,
    redirectUri: params.redirectUri,
    scope: params.scope,
    expiresAt: Date.now() + 10 * 60 * 1000,
    encryptedAppKey: params.encryptedAppKey,
    nonce: params.nonce,
  });

  return code;
}

async function buildTokenResponseFromAuthorizationCode(params: {
  authCode: {
    userId: string;
    identityId: string;
    scope: string;
    nonce?: string;
    encryptedAppKey?: string;
  };
  oauthApp: ReturnType<typeof buildQuickApp> | typeof oauthApps.$inferSelect;
  clientId: string;
  redirectUri: string;
  includeEncryptedAppKey?: boolean;
}) {
  const { authCode, oauthApp, clientId, redirectUri, includeEncryptedAppKey } = params;

  const accessToken = generateAccessToken();
  const accessTokenTtl = oauthApp.accessTokenTtlSeconds || 3600;
  const refreshTokenTtl = oauthApp.refreshTokenTtlSeconds || 30 * 24 * 60 * 60;

  await setAccessToken(accessToken, {
    userId: authCode.userId,
    identityId: authCode.identityId,
    appId: oauthApp.id,
    scope: authCode.scope,
    expiresAt: Date.now() + accessTokenTtl * 1000,
    redirectUri,
  });

  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.id, authCode.identityId))
    .limit(1);

  const subject = authCode.identityId;
  const issuedAt = nowSeconds();
  const expiresAt = issuedAt + accessTokenTtl;

  const response: Record<string, unknown> = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: accessTokenTtl,
    scope: authCode.scope,
    user: identity ? {
      id: identity.id,
      handle: identity.handle,
      displayName: identity.displayName,
      email: identity.email,
      avatarUrl: identity.avatarUrl,
    } : null,
  };

  const jwtAccessToken = await signJwt({
    iss: getIssuer(),
    sub: subject,
    aud: getResourceAudience(),
    exp: expiresAt,
    iat: issuedAt,
    scope: authCode.scope,
    cid: oauthApp.clientId,
    sid: authCode.userId,
    uid: hasScope(authCode.scope, "user_id") && oauthApp.allowUserIdScope ? authCode.userId : undefined,
    ...(isQuickClient(clientId) ? { quick: true } : {}),
  });

  response.access_token_jwt = jwtAccessToken;

  if (hasScope(authCode.scope, "user_id") && oauthApp.allowUserIdScope) {
    response.user_id = authCode.userId;
  }

  if (hasScope(authCode.scope, "openid")) {
    const idToken = await signJwt({
      iss: getIssuer(),
      sub: subject,
      aud: oauthApp.clientId,
      exp: expiresAt,
      iat: issuedAt,
      auth_time: issuedAt,
      azp: oauthApp.clientId,
      sid: authCode.userId,
      nonce: authCode.nonce,
      name: hasScope(authCode.scope, "profile") ? identity?.displayName : undefined,
      preferred_username: hasScope(authCode.scope, "profile") ? identity?.handle : undefined,
      email: hasScope(authCode.scope, "email") ? identity?.email : undefined,
      picture: hasScope(authCode.scope, "profile") ? identity?.avatarUrl : undefined,
    });
    response.id_token = idToken;
  }

  if (hasScope(authCode.scope, "offline_access") && !isQuickClient(clientId)) {
    const refreshToken = generateRefreshToken();
    await db.insert(oauthRefreshTokens).values({
      userId: authCode.userId,
      identityId: authCode.identityId,
      appId: oauthApp.id,
      tokenHash: hashToken(refreshToken),
      scope: authCode.scope,
      expiresAt: new Date(Date.now() + refreshTokenTtl * 1000),
    });
    response.refresh_token = refreshToken;
  }

  if (includeEncryptedAppKey && authCode.encryptedAppKey) {
    response.encryptedAppKey = authCode.encryptedAppKey;
  }

  return response;
}

// ============================================
// Quick Auth helpers — no app registration required.
// clientId format: "origin:<origin>"  e.g. "origin:https://example.com"
// Security is provided by PKCE; no client secret is needed or accepted.
// ============================================
const QUICK_AUTH_ACCESS_TOKEN_TTL_SECONDS = 3600;
const QUICK_AUTH_SCOPES = ["openid", "profile", "email"];

function isQuickClient(clientId: string): boolean {
  return typeof clientId === "string" && clientId.startsWith("origin:");
}

function getQuickOrigin(clientId: string): string | null {
  try {
    const raw = clientId.slice("origin:".length);
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function buildQuickApp(clientId: string) {
  return {
    id: clientId,
    clientId,
    name: "Quick Ave",
    description: null as string | null,
    iconUrl: null as string | null,
    websiteUrl: null as string | null,
    clientSecretHash: "",
    redirectUris: [] as string[],
    allowedScopes: [...QUICK_AUTH_SCOPES],
    accessTokenTtlSeconds: QUICK_AUTH_ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: 0,
    allowUserIdScope: false,
    supportsE2ee: false,
    ownerId: null as string | null,
    createdAt: new Date(),
  };
}


// Public: Get OAuth app info (for authorization screen)
app.get("/app/:clientId", async (c) => {
  const clientId = c.req.param("clientId");
  c.header("Cache-Control", "public, max-age=60, s-maxage=300");

  if (isQuickClient(clientId)) {
    const quickOrigin = getQuickOrigin(clientId);
    if (!quickOrigin) {
      return c.json({ error: "App not found" }, 404);
    }
    return c.json({
      app: {
        id: clientId,
        name: quickOrigin,
        description: "Quick Ave — authenticate without app registration",
        iconUrl: null,
        websiteUrl: quickOrigin,
        supportsE2ee: false,
      },
      resources: [],
    });
  }

  const [oauthApp] = await db
    .select({
      id: oauthApps.id,
      name: oauthApps.name,
      description: oauthApps.description,
      iconUrl: oauthApps.iconUrl,
      websiteUrl: oauthApps.websiteUrl,
      supportsE2ee: oauthApps.supportsE2ee,
    })
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);
  
  if (!oauthApp) {
    return c.json({ error: "App not found" }, 404);
  }

  const resources = await db
    .select({
      resourceKey: oauthResources.resourceKey,
      displayName: oauthResources.displayName,
      description: oauthResources.description,
      scopes: oauthResources.scopes,
      audience: oauthResources.audience,
      status: oauthResources.status,
    })
    .from(oauthResources)
    .where(and(eq(oauthResources.ownerAppId, (oauthApp as any).id), eq(oauthResources.status, "active")));
  
  return c.json({ app: oauthApp, resources });
});

// Public: Get connector resource info by resource key (for connector UX)
app.get("/resource/:resourceKey", async (c) => {
  const resourceKey = c.req.param("resourceKey");
  c.header("Cache-Control", "public, max-age=60, s-maxage=300");

  const [resource] = await db
    .select({
      resourceKey: oauthResources.resourceKey,
      displayName: oauthResources.displayName,
      description: oauthResources.description,
      scopes: oauthResources.scopes,
      audience: oauthResources.audience,
      status: oauthResources.status,
      ownerAppClientId: oauthApps.clientId,
      ownerAppName: oauthApps.name,
      ownerAppDescription: oauthApps.description,
      ownerAppIconUrl: oauthApps.iconUrl,
      ownerAppWebsiteUrl: oauthApps.websiteUrl,
    })
    .from(oauthResources)
    .innerJoin(oauthApps, eq(oauthResources.ownerAppId, oauthApps.id))
    .where(and(eq(oauthResources.resourceKey, resourceKey), eq(oauthResources.status, "active")))
    .limit(1);

  if (!resource) {
    return c.json({ error: "Resource not found" }, 404);
  }

  return c.json({ resource });
});

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
      email: identity.email || `${identity.handle}@aveid.net`,
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

  let extraParams: Record<string, unknown> = {};
  if (rawParams) {
    try {
      extraParams = JSON.parse(rawParams);
    } catch {
      return c.json({ error: { code: "invalid_request", url: `${getWebBase()}/docs` } }, 400);
    }
  }

  const redirectUri = typeof extraParams.redirectUri === "string" ? extraParams.redirectUri : "";
  const scope = typeof extraParams.scope === "string" ? extraParams.scope : "openid profile email";
  const state = typeof extraParams.state === "string" ? extraParams.state : "";
  const nonce = typeof extraParams.nonce === "string" ? extraParams.nonce : undefined;

  const oauthApp = await resolveOauthAppForClient(clientId);
  if (!oauthApp) {
    return c.json({ error: { code: "unauthorized_client", url: `${getWebBase()}/docs` } }, 400);
  }

  if (!origin || !isAllowedClientOriginForApp(oauthApp, origin)) {
    return c.json({ error: { code: "access_denied", url: `${getWebBase()}/docs` } }, 403);
  }

  if (!redirectUri || !(oauthApp.redirectUris as string[]).includes(redirectUri)) {
    return c.json({ error: { code: "invalid_request", url: `${getWebBase()}/docs` } }, 400);
  }

  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, accountId), eq(identities.userId, user.id)))
    .limit(1);

  if (!identity) {
    return c.json({ error: { code: "access_denied", url: `${getWebBase()}/login` } }, 403);
  }

  const [existingAuth] = await db
    .select()
    .from(oauthAuthorizations)
    .where(and(
      eq(oauthAuthorizations.userId, user.id),
      eq(oauthAuthorizations.appId, oauthApp.id),
      eq(oauthAuthorizations.identityId, identity.id),
    ))
    .limit(1);

  if (oauthApp.supportsE2ee || !existingAuth) {
    const continueUrl = new URL(`${getWebBase()}/authorize`);
    continueUrl.searchParams.set("client_id", clientId);
    continueUrl.searchParams.set("redirect_uri", redirectUri);
    continueUrl.searchParams.set("scope", scope);
    if (state) continueUrl.searchParams.set("state", state);
    if (nonce) continueUrl.searchParams.set("nonce", nonce);
    continueUrl.searchParams.set("identity_id", identity.id);
    continueUrl.searchParams.set("fedcm_continue", "1");

    return c.json({ continue_on: continueUrl.toString() });
  }

  const code = await issueAuthorizationCodeForApp({
    userId: user.id,
    appId: oauthApp.id,
    identityId: identity.id,
    redirectUri,
    scope,
    nonce,
    encryptedAppKey: existingAuth.encryptedAppKey || undefined,
  });

  const assertion = await signJwt({
    iss: getIssuer(),
    aud: clientId,
    sub: identity.id,
    sid: user.id,
    typ: "ave_fedcm",
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state || undefined,
    nonce,
    exp: nowSeconds() + 5 * 60,
    iat: nowSeconds(),
  });

  return c.json({ token: assertion });
});

app.get("/authorize/bootstrap/:clientId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const clientId = c.req.param("clientId") || "";

  if (isQuickClient(clientId)) {
    const quickOrigin = getQuickOrigin(clientId);
    if (!quickOrigin) {
      return c.json({ error: "App not found" }, 404);
    }

    return c.json({
      app: {
        id: clientId,
        name: quickOrigin,
        description: "Quick Ave â€” authenticate without app registration",
        iconUrl: null,
        websiteUrl: quickOrigin,
        supportsE2ee: false,
      },
      resources: [],
      authorization: null,
    });
  }

  const [oauthApp] = await db
    .select({
      id: oauthApps.id,
      name: oauthApps.name,
      description: oauthApps.description,
      iconUrl: oauthApps.iconUrl,
      websiteUrl: oauthApps.websiteUrl,
      supportsE2ee: oauthApps.supportsE2ee,
    })
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);

  if (!oauthApp) {
    return c.json({ error: "App not found" }, 404);
  }

  const [resources, authorization] = await Promise.all([
    db
      .select({
        resourceKey: oauthResources.resourceKey,
        displayName: oauthResources.displayName,
        description: oauthResources.description,
        scopes: oauthResources.scopes,
        audience: oauthResources.audience,
        status: oauthResources.status,
      })
      .from(oauthResources)
      .where(and(eq(oauthResources.ownerAppId, oauthApp.id), eq(oauthResources.status, "active"))),
    db
      .select()
      .from(oauthAuthorizations)
      .where(and(
        eq(oauthAuthorizations.userId, user.id),
        eq(oauthAuthorizations.appId, oauthApp.id),
      ))
      .orderBy(desc(oauthAuthorizations.lastAuthorizedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  return c.json({
    app: oauthApp,
    resources,
    authorization: authorization
      ? {
          id: authorization.id,
          identityId: authorization.identityId,
          encryptedAppKey: authorization.encryptedAppKey,
          createdAt: authorization.createdAt,
        }
      : null,
  });
});

// Authorization endpoint - user grants access
app.post("/authorize", requireAuth, zValidator("json", z.object({
  clientId: z.string(),
  redirectUri: z.string().url(),
  scope: z.string().optional().default("profile"),
  state: z.string().optional(),
  identityId: z.string().uuid(),
  codeChallenge: z.string().optional(), // PKCE
  codeChallengeMethod: z.enum(["S256", "plain"]).optional(),
  encryptedAppKey: z.string().optional(), // E2EE: app key encrypted with user's master key
  nonce: z.string().optional(),
  connector: z.boolean().optional().default(false),
  requestedResource: z.string().optional(),
  requestedScope: z.string().optional(),
  communicationMode: z.enum(["user_present", "background"]).optional().default("user_present"),
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
    nonce,
    connector,
    requestedResource,
    requestedScope,
    communicationMode,
    interactionMode,
  } = c.req.valid("json");

  
  // Find (or derive) the OAuth app
  const isQuick = isQuickClient(clientId);
  let oauthApp: ReturnType<typeof buildQuickApp> | typeof oauthApps.$inferSelect;

  if (isQuick) {
    const quickOrigin = getQuickOrigin(clientId);
    if (!quickOrigin) {
      return c.json({ error: "Invalid client_id" }, 400);
    }
    let redirectOrigin: string;
    try { redirectOrigin = new URL(redirectUri).origin; } catch {
      return c.json({ error: "Invalid redirect_uri" }, 400);
    }
    if (redirectOrigin !== quickOrigin) {
      return c.json({ error: "Invalid redirect_uri" }, 400);
    }
    // PKCE is mandatory for Quick Auth (there is no client secret)
    if (!codeChallenge) {
      return c.json({ error: "invalid_request", error_description: "code_challenge is required for Quick Ave" }, 400);
    }
    // Enforce strong PKCE method for Quick Ave: only S256 is allowed
    if (codeChallengeMethod !== "S256") {
      return c.json({ error: "invalid_request", error_description: "code_challenge_method must be S256 for Quick Ave" }, 400);
    }
    oauthApp = buildQuickApp(clientId);
  } else {
    const [app] = await db
      .select()
      .from(oauthApps)
      .where(eq(oauthApps.clientId, clientId))
      .limit(1);

    if (!app) {
      return c.json({ error: "Invalid client_id" }, 400);
    }
    oauthApp = app;

    // Validate redirect URI
    const allowedUris = oauthApp.redirectUris as string[];
    if (!allowedUris.includes(redirectUri)) {
      return c.json({ error: "Invalid redirect_uri" }, 400);
    }
  }

  const requestedScopes = parseScopes(scope);
  const allowedScopes = (oauthApp.allowedScopes || []) as string[];
  const invalidScopes = requestedScopes.filter((s) => !allowedScopes.includes(s));
  if (invalidScopes.length > 0) {
    return c.json({ error: "invalid_scope", error_description: `Invalid scopes: ${invalidScopes.join(", ")}` }, 400);
  }

  
  // Validate identity belongs to user
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Invalid identity" }, 400);
  }

  const authorizationMethod = interactionMode === "instant"
    ? "instant"
    : user.authMethod === "passkey"
      ? "passkey"
      : user.authMethod === "trust_code" || user.authMethod === "device_approval"
      ? "fallback"
      : user.authMethod || "unknown";

  // Track authorization (skipped for Quick Auth — no persistent app record)
  let existingAuth: typeof oauthAuthorizations.$inferSelect | undefined;
  let createdAuthorization = false;
  if (!isQuick) {
    const [found] = await db
      .select()
      .from(oauthAuthorizations)
      .where(and(
        eq(oauthAuthorizations.userId, user.id),
        eq(oauthAuthorizations.appId, oauthApp.id),
        eq(oauthAuthorizations.identityId, identityId),
      ))
      .limit(1);
    existingAuth = found;

    // For E2EE apps, require encrypted app key only if there's no existing authorization with a key
    if (oauthApp.supportsE2ee && !encryptedAppKey && !existingAuth?.encryptedAppKey) {
      return c.json({ error: "E2EE app requires encryptedAppKey" }, 400);
    }

    if (!existingAuth) {
      // Create new authorization with encrypted app key
      await db.insert(oauthAuthorizations).values({
        userId: user.id,
        appId: oauthApp.id,
        identityId,
        lastAuthorizedAt: new Date(),
        authorizationCount: 1,
        lastAuthMethod: authorizationMethod,
        encryptedAppKey: encryptedAppKey || null,
      });
      createdAuthorization = true;
    } else if (oauthApp.supportsE2ee && !existingAuth.encryptedAppKey && encryptedAppKey) {
      // If existing auth doesn't have an app key but we're providing one now, update it
      await db.update(oauthAuthorizations)
        .set({
          encryptedAppKey,
          lastAuthorizedAt: new Date(),
          authorizationCount: existingAuth.authorizationCount + 1,
          lastAuthMethod: authorizationMethod,
        })
        .where(eq(oauthAuthorizations.id, existingAuth.id));
    } else {
      await db.update(oauthAuthorizations)
        .set({
          lastAuthorizedAt: new Date(),
          authorizationCount: existingAuth.authorizationCount + 1,
          lastAuthMethod: authorizationMethod,
        })
        .where(eq(oauthAuthorizations.id, existingAuth.id));
    }
  }

  let delegationGrantId: string | undefined;
  let resolvedRequestedScope: string | undefined;

  if (connector) {
    if (isQuick) {
      return c.json({ error: "invalid_request", error_description: "Connector flow is not supported for Quick Ave" }, 400);
    }
    if (!requestedResource || !requestedScope) {
      return c.json({ error: "invalid_request", error_description: "requestedResource and requestedScope are required for connector flow" }, 400);
    }

    const [resource] = await db
      .select()
      .from(oauthResources)
      .where(and(eq(oauthResources.resourceKey, requestedResource), eq(oauthResources.status, "active")))
      .limit(1);

    if (!resource) {
      return c.json({ error: "invalid_target", error_description: "Requested resource not found" }, 400);
    }

    const allowedResourceScopes = (resource.scopes || []) as string[];
    const requestedConnectorScopes = parseScopes(requestedScope);
    const invalidConnectorScopes = requestedConnectorScopes.filter((s) => !allowedResourceScopes.includes(s));
    if (invalidConnectorScopes.length > 0) {
      return c.json({ error: "invalid_scope", error_description: `Invalid connector scopes: ${invalidConnectorScopes.join(", ")}` }, 400);
    }

    const [existingGrant] = await db
      .select()
      .from(oauthDelegationGrants)
      .where(and(
        eq(oauthDelegationGrants.userId, user.id),
        eq(oauthDelegationGrants.identityId, identityId),
        eq(oauthDelegationGrants.sourceAppId, oauthApp.id),
        eq(oauthDelegationGrants.targetResourceId, resource.id),
        isNull(oauthDelegationGrants.revokedAt),
      ))
      .limit(1);

    if (!existingGrant) {
      const [newGrant] = await db.insert(oauthDelegationGrants).values({
        userId: user.id,
        identityId,
        sourceAppId: oauthApp.id,
        targetResourceId: resource.id,
        scope: requestedConnectorScopes.join(" "),
        communicationMode,
      }).returning();
      delegationGrantId = newGrant.id;
      resolvedRequestedScope = newGrant.scope;
    } else {
      const mergedScope = Array.from(new Set([...parseScopes(existingGrant.scope), ...requestedConnectorScopes])).join(" ");
      await db.update(oauthDelegationGrants)
        .set({
          scope: mergedScope,
          communicationMode,
          updatedAt: new Date(),
        })
        .where(eq(oauthDelegationGrants.id, existingGrant.id));
      delegationGrantId = existingGrant.id;
      resolvedRequestedScope = mergedScope;
    }

    await db.insert(oauthDelegationAuditLogs).values({
      grantId: delegationGrantId,
      userId: user.id,
      sourceAppId: oauthApp.id,
      targetResourceId: resource.id,
      eventType: "grant_created",
      details: {
        requestedResource,
        requestedScope: requestedConnectorScopes.join(" "),
        communicationMode,
      },
    });
  }
  
  // Generate authorization code
  const code = generateAuthCode();
  
  // Get the encrypted app key to include in the auth code
  // Either from the new authorization or from an existing one
  const finalEncryptedAppKey = encryptedAppKey || existingAuth?.encryptedAppKey || undefined;
  
  await setAuthorizationCode(code, {
    userId: user.id,
    appId: oauthApp.id,
    identityId,
    redirectUri,
    scope,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    codeChallenge,
    codeChallengeMethod,
    encryptedAppKey: finalEncryptedAppKey,
    nonce: nonce || undefined,
    requestedResource: connector ? requestedResource : undefined,
    requestedScope: connector ? resolvedRequestedScope || requestedScope : undefined,
    communicationMode: connector ? communicationMode : undefined,
    delegationGrantId,
  });

  
  // Log activity
  await db.insert(activityLogs).values({
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

  if (!isQuick && createdAuthorization) {
    await db.insert(appAnalyticsEvents).values({
      appId: oauthApp.id,
      identityId,
      eventType: "authorization_added",
      authMethod: user.authMethod || "unknown",
      severity: "info",
      metadata: { scope },
    });
  }
  
  // Build redirect URL with code
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }
  
  return c.json({ redirectUrl: redirectUrl.toString() });
});

// Token endpoint - exchange code for access token
app.post("/token", zValidator("json", z.discriminatedUnion("grantType", [
  z.object({
    grantType: z.literal("authorization_code"),
    code: z.string(),
    redirectUri: z.string().url(),
    clientId: z.string(),
    clientSecret: z.string().optional(),
    codeVerifier: z.string().optional(), // PKCE
  }),
  z.object({
    grantType: z.literal("refresh_token"),
    refreshToken: z.string(),
    clientId: z.string(),
    clientSecret: z.string().optional(),
  }),
  z.object({
    grantType: z.literal("urn:ietf:params:oauth:grant-type:token-exchange"),
    subjectToken: z.string(),
    requestedResource: z.string(),
    requestedScope: z.string(),
    clientId: z.string(),
    clientSecret: z.string().optional(),
    actor: z.record(z.string(), z.unknown()).optional(),
  }),
])), async (c) => {
  const payload = c.req.valid("json");

  if (payload.grantType === "urn:ietf:params:oauth:grant-type:token-exchange") {
    const { subjectToken, requestedResource, requestedScope, clientId, clientSecret, actor } = payload;

    const [sourceApp] = await db
      .select()
      .from(oauthApps)
      .where(eq(oauthApps.clientId, clientId))
      .limit(1);

    if (!sourceApp) {
      return c.json({ error: "invalid_client", error_description: "Client not found" }, 400);
    }

    if (clientSecret) {
      const expectedHash = sourceApp.clientSecretHash;
      const providedHash = hashSessionToken(clientSecret);
      if (expectedHash !== providedHash) {
        return c.json({ error: "invalid_client", error_description: "Invalid client secret" }, 400);
      }
    }

    let subject: {
      userId: string;
      identityId: string;
      sourceAppId: string;
      scope: string;
    } | null = null;

    const storedOpaqueSubject = await getAccessToken(subjectToken);
    if (storedOpaqueSubject) {
      subject = {
        userId: storedOpaqueSubject.userId,
        identityId: storedOpaqueSubject.identityId,
        sourceAppId: storedOpaqueSubject.appId,
        scope: storedOpaqueSubject.scope,
      };
    } else {
      const jwtPayload = await verifyJwt(subjectToken, getResourceAudience());
      if (jwtPayload) {
        const tokenClientId = String(jwtPayload.cid || "");
        const [tokenApp] = await db
          .select()
          .from(oauthApps)
          .where(eq(oauthApps.clientId, tokenClientId))
          .limit(1);

        if (tokenApp) {
          subject = {
            userId: String(jwtPayload.sid || ""),
            identityId: String(jwtPayload.sub || ""),
            sourceAppId: tokenApp.id,
            scope: String(jwtPayload.scope || ""),
          };
        }
      }
    }

    if (!subject) {
      return c.json({ error: "invalid_grant", error_description: "Subject token is invalid" }, 400);
    }

    if (subject.sourceAppId !== sourceApp.id) {
      return c.json({ error: "invalid_grant", error_description: "Subject token does not belong to client" }, 400);
    }

    const [resource] = await db
      .select()
      .from(oauthResources)
      .where(and(eq(oauthResources.resourceKey, requestedResource), eq(oauthResources.status, "active")))
      .limit(1);

    if (!resource) {
      return c.json({ error: "invalid_target", error_description: "Requested resource not found" }, 400);
    }

    const requestedConnectorScopes = parseScopes(requestedScope);
    const invalidScopes = requestedConnectorScopes.filter((scope) => !((resource.scopes || []) as string[]).includes(scope));
    if (invalidScopes.length > 0) {
      return c.json({ error: "invalid_scope", error_description: `Invalid connector scopes: ${invalidScopes.join(", ")}` }, 400);
    }

    const [grant] = await db
      .select()
      .from(oauthDelegationGrants)
      .where(and(
        eq(oauthDelegationGrants.userId, subject.userId),
        eq(oauthDelegationGrants.identityId, subject.identityId),
        eq(oauthDelegationGrants.sourceAppId, sourceApp.id),
        eq(oauthDelegationGrants.targetResourceId, resource.id),
        isNull(oauthDelegationGrants.revokedAt),
      ))
      .limit(1);

    if (!grant) {
      return c.json({ error: "access_denied", error_description: "No active connector grant found" }, 403);
    }

    if (!hasAllScopes(grant.scope, requestedScope)) {
      return c.json({ error: "invalid_scope", error_description: "Requested scope exceeds granted scope" }, 400);
    }

    const expiresIn = 10 * 60;
    const issuedAt = nowSeconds();
    const expiresAt = issuedAt + expiresIn;

    const delegatedAccessTokenJwt = await signJwt({
      iss: getIssuer(),
      sub: subject.identityId,
      aud: resource.audience,
      exp: expiresAt,
      iat: issuedAt,
      sid: subject.userId,
      cid: sourceApp.clientId,
      scope: requestedConnectorScopes.join(" "),
      grant_id: grant.id,
      target_resource: resource.resourceKey,
      com_mode: grant.communicationMode,
      actor,
    });

    await db.insert(oauthDelegationAuditLogs).values({
      grantId: grant.id,
      userId: subject.userId,
      sourceAppId: sourceApp.id,
      targetResourceId: resource.id,
      eventType: "token_exchanged",
      details: {
        requestedResource,
        requestedScope: requestedConnectorScopes.join(" "),
      },
    });

    return c.json({
      access_token: delegatedAccessTokenJwt,
      token_type: "Bearer",
      expires_in: expiresIn,
      scope: requestedConnectorScopes.join(" "),
      audience: resource.audience,
      target_resource: resource.resourceKey,
      communication_mode: grant.communicationMode,
    });
  }

  if (payload.grantType === "refresh_token") {
    const { refreshToken, clientId, clientSecret } = payload;

    const [oauthApp] = await db
      .select()
      .from(oauthApps)
      .where(eq(oauthApps.clientId, clientId))
      .limit(1);

    if (!oauthApp) {
      return c.json({ error: "invalid_client", error_description: "Client not found" }, 400);
    }

    if (clientSecret) {
      const expectedHash = oauthApp.clientSecretHash;
      const providedHash = hashSessionToken(clientSecret);
      if (expectedHash !== providedHash) {
        return c.json({ error: "invalid_client", error_description: "Invalid client secret" }, 400);
      }
    }

    const tokenHash = hashToken(refreshToken);
    const [storedRefresh] = await db
      .select()
      .from(oauthRefreshTokens)
      .where(eq(oauthRefreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!storedRefresh) {
      await db.update(oauthRefreshTokens)
        .set({ reuseDetectedAt: new Date() })
        .where(and(eq(oauthRefreshTokens.appId, oauthApp.id), isNull(oauthRefreshTokens.revokedAt)));
      return c.json({ error: "invalid_grant", error_description: "Refresh token not found" }, 400);
    }

    if (storedRefresh.revokedAt || storedRefresh.reuseDetectedAt) {
      await db.update(oauthRefreshTokens)
        .set({ reuseDetectedAt: new Date() })
        .where(eq(oauthRefreshTokens.appId, storedRefresh.appId));
      return c.json({ error: "invalid_grant", error_description: "Refresh token revoked" }, 400);
    }

    if (new Date() > storedRefresh.expiresAt) {
      await db.update(oauthRefreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(oauthRefreshTokens.id, storedRefresh.id));
      return c.json({ error: "invalid_grant", error_description: "Refresh token expired" }, 400);
    }

    const accessTokenTtl = oauthApp.accessTokenTtlSeconds || 3600;
    const refreshTokenTtl = oauthApp.refreshTokenTtlSeconds || 30 * 24 * 60 * 60;

    const accessToken = generateAccessToken();
    await setAccessToken(accessToken, {
      userId: storedRefresh.userId,
      identityId: storedRefresh.identityId,
      appId: storedRefresh.appId,
      scope: storedRefresh.scope,
      expiresAt: Date.now() + accessTokenTtl * 1000,
      redirectUri: "",
    });

    const rotatedRefreshToken = generateRefreshToken();
    await db.update(oauthRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(oauthRefreshTokens.id, storedRefresh.id));

    await db.insert(oauthRefreshTokens).values({
      userId: storedRefresh.userId,
      identityId: storedRefresh.identityId,
      appId: storedRefresh.appId,
      tokenHash: hashToken(rotatedRefreshToken),
      scope: storedRefresh.scope,
      expiresAt: new Date(Date.now() + refreshTokenTtl * 1000),
      rotatedFromId: storedRefresh.id,
    });

    const [identity] = await db
      .select()
      .from(identities)
      .where(eq(identities.id, storedRefresh.identityId))
      .limit(1);

    const issuedAt = nowSeconds();
    const expiresAt = issuedAt + accessTokenTtl;

    const idToken = await signJwt({
      iss: getIssuer(),
      sub: storedRefresh.identityId,
      aud: oauthApp.clientId,
      exp: expiresAt,
      iat: issuedAt,
      auth_time: issuedAt,
      azp: oauthApp.clientId,
      sid: storedRefresh.userId,
      name: hasScope(storedRefresh.scope, "profile") ? identity?.displayName : undefined,
      preferred_username: hasScope(storedRefresh.scope, "profile") ? identity?.handle : undefined,
      email: hasScope(storedRefresh.scope, "email") ? identity?.email : undefined,
      picture: hasScope(storedRefresh.scope, "profile") ? identity?.avatarUrl : undefined,
    });

    const jwtAccessToken = await signJwt({
      iss: getIssuer(),
      sub: storedRefresh.identityId,
      aud: getResourceAudience(),
      exp: expiresAt,
      iat: issuedAt,
      scope: storedRefresh.scope,
      cid: oauthApp.clientId,
      sid: storedRefresh.userId,
      uid: hasScope(storedRefresh.scope, "user_id") && oauthApp.allowUserIdScope ? storedRefresh.userId : undefined,
    });

    const response: Record<string, unknown> = {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: accessTokenTtl,
      refresh_token: rotatedRefreshToken,
      id_token: idToken,
      access_token_jwt: jwtAccessToken,
    };

    if (hasScope(storedRefresh.scope, "user_id") && oauthApp.allowUserIdScope) {
      response.user_id = storedRefresh.userId;
    }

    return c.json(response);
  }

  const { code, redirectUri, clientId, clientSecret, codeVerifier } = payload;

  
  // Find authorization code
  const authCodeResult = await consumeAuthorizationCode(code);
  if (!authCodeResult.value) {
    return c.json({
      error: "invalid_grant",
      error_description: authCodeResult.expired ? "Authorization code expired" : "Authorization code not found",
    }, 400);
  }
  const authCode = authCodeResult.value;
  
  if (authCode.redirectUri !== redirectUri) {
    return c.json({ error: "invalid_grant", error_description: "Redirect URI mismatch" }, 400);
  }
  
  // Find (or derive) the OAuth app
  let oauthApp: ReturnType<typeof buildQuickApp> | typeof oauthApps.$inferSelect;
  if (isQuickClient(clientId)) {
    // Quick Auth: PKCE is mandatory — it must have been set at authorize time
    if (!authCode.codeChallenge) {
      return c.json({ error: "invalid_request", error_description: "PKCE is required for Quick Ave" }, 400);
    }
    // Validate that the redirect_uri origin matches the client_id origin
    // (mirrors the check performed at authorize time)
    const quickOrigin = getQuickOrigin(clientId);
    if (!quickOrigin) {
      return c.json({ error: "invalid_client", error_description: "Invalid client_id" }, 400);
    }
    let redirectOrigin: string;
    try { redirectOrigin = new URL(redirectUri).origin; } catch (err) {
      if (!(err instanceof TypeError)) throw err;
      return c.json({ error: "invalid_grant", error_description: "Invalid redirect_uri" }, 400);
    }
    if (redirectOrigin !== quickOrigin) {
      return c.json({ error: "invalid_grant", error_description: "redirect_uri origin does not match client_id" }, 400);
    }
    // When the browser sends an Origin header (always present for cross-origin fetch),
    // it must match the client_id origin — this cannot be forged by browser code.
    const requestOrigin = c.req.header("Origin");
    if (requestOrigin && requestOrigin !== quickOrigin) {
      return c.json({ error: "invalid_client", error_description: "Request origin does not match client_id" }, 400);
    }
    oauthApp = buildQuickApp(clientId);
  } else {
    const [app] = await db
      .select()
      .from(oauthApps)
      .where(eq(oauthApps.clientId, clientId))
      .limit(1);

    if (!app) {
      return c.json({ error: "invalid_client", error_description: "Client not found" }, 400);
    }
    oauthApp = app;
  }

  // Verify the client presenting the code is the same one that received it at
  // authorize time. For Quick clients oauthApp.id === clientId; for standard
  // clients oauthApp.id is the database UUID stored in the auth code.
  if (oauthApp.id !== authCode.appId) {
    return c.json({ error: "invalid_grant", error_description: "client_id does not match authorization" }, 400);
  }

  // Verify client secret or PKCE code verifier
  if (authCode.codeChallenge) {
    // PKCE flow
    if (!codeVerifier) {
      return c.json({ error: "invalid_request", error_description: "Code verifier required" }, 400);
    }
    if (!isValidPkceCodeVerifier(codeVerifier)) {
      return c.json({ error: "invalid_request", error_description: "Code verifier must be 43-128 characters and use the PKCE character set" }, 400);
    }
    
    let computedChallenge: string;
    if (authCode.codeChallengeMethod === "S256") {
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const hash = await crypto.subtle.digest("SHA-256", data);
      computedChallenge = Buffer.from(hash).toString("base64url");
    } else {
      computedChallenge = codeVerifier;
    }
    
    if (!timingSafeEqualString(computedChallenge, authCode.codeChallenge)) {
      return c.json({ error: "invalid_grant", error_description: "Code verifier mismatch" }, 400);
    }
  } else if (clientSecret) {
    // Client secret flow
    const expectedHash = oauthApp.clientSecretHash;
    const providedHash = hashSessionToken(clientSecret); // Using same hash function
    if (expectedHash !== providedHash) {
      return c.json({ error: "invalid_client", error_description: "Invalid client secret" }, 400);
    }
  } else {
    return c.json({ error: "invalid_request", error_description: "Client authentication required" }, 400);
  }

  const baseScopes = (oauthApp.allowedScopes && oauthApp.allowedScopes.length > 0
    ? oauthApp.allowedScopes
    : ["openid", "profile", "email", "offline_access"]) as string[];
  const allowedScopes = oauthApp.allowUserIdScope
    ? [...new Set([...baseScopes, "user_id"])]
    : baseScopes;
  const requestedScopes = parseScopes(authCode.scope);
  const invalidScopes = requestedScopes.filter((s) => !allowedScopes.includes(s));
  if (invalidScopes.length > 0) {
    return c.json({ error: "invalid_scope", error_description: `Invalid scopes: ${invalidScopes.join(", ")}` }, 400);
  }

  const response = await buildTokenResponseFromAuthorizationCode({
    authCode,
    oauthApp,
    clientId,
    redirectUri,
  });
  
  // Note: the app key is NOT included in the JSON token response.
  // The Ave authorization UI decrypts the server-stored encrypted key using the user's master key
  // during the consent step and passes the plaintext key to the app as #app_key=... in the
  // callback redirect URL fragment — it never appears in server logs or JSON response bodies.
  
  return c.json(response);
});


oidcRoutes.get("/openid-configuration", (c) => {
  const issuer = getIssuer();
  const discoveryBase = getDiscoveryBase();
  return c.json({
    issuer,
    authorization_endpoint: `${issuer}/signin`,
    token_endpoint: `${discoveryBase}/api/oauth/token`,
    userinfo_endpoint: `${discoveryBase}/api/oauth/userinfo`,
    jwks_uri: `${discoveryBase}/.well-known/jwks.json`,
    scopes_supported: ["openid", "profile", "email", "offline_access", "user_id"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:token-exchange"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
  });
});

oidcRoutes.get("/jwks.json", async (c) => {
  try {
    return c.json({ keys: [await getJwtPublicJwk()] });
  } catch (error) {
    return c.json({ error: "JWKS not configured" }, 500);
  }
});

// User info endpoint - get current user info
app.get("/userinfo", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  let record = await getAccessToken(token);

  if (!record) {
    const jwtPayload = await verifyJwt(token, getResourceAudience());
    if (!jwtPayload) {
      return c.json({ error: "invalid_token" }, 401);
    }

    record = {
      userId: String(jwtPayload.sid || ""),
      identityId: String(jwtPayload.sub || ""),
      appId: String(jwtPayload.cid || ""),
      scope: String(jwtPayload.scope || ""),
      expiresAt: (typeof jwtPayload.exp === "number" ? jwtPayload.exp * 1000 : 0),
      redirectUri: "",
    };
  }

  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.id, record.identityId))
    .limit(1);

  if (!identity) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const response: Record<string, unknown> = {
    sub: identity.id,
  };

  if (hasScope(record.scope, "profile")) {
    response.name = identity.displayName;
    response.preferred_username = identity.handle;
    response.picture = identity.avatarUrl;
  }

  if (hasScope(record.scope, "email")) {
    response.email = identity.email;
  }

  if (hasScope(record.scope, "user_id")) {
    const [oauthApp] = await db
      .select()
      .from(oauthApps)
      .where(eq(oauthApps.id, record.appId))
      .limit(1);

    if (oauthApp?.allowUserIdScope) {
      response.user_id = record.userId;
    }
  }

  response.iss = getIssuer();

  return c.json(response);
});


// Session check endpoint — used by Quick Ave session monitor.
app.post("/session/check", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "invalid_token", reason: "invalid_token" }, 401);
  }

  const token = authHeader.slice(7);

  // Check stored opaque access tokens first
  const record = await getAccessToken(token);
  if (record) {
    return c.json({ status: "active" });
  }

  // Fall back to JWT verification
  const jwtPayload = await verifyJwt(token, getResourceAudience());
  if (!jwtPayload) {
    return c.json({ error: "invalid_token", reason: "invalid_token" }, 401);
  }

  return c.json({ status: "active" });
});

app.post("/fedcm/finalize", requireAuth, zValidator("json", z.object({
  code: z.string(),
  clientId: z.string(),
  state: z.string().optional(),
  appKey: z.string().optional(),
})), async (c) => {
  const user = c.get("user")!;
  const { code, clientId, state, appKey } = c.req.valid("json");

  const authCodeResult = await getAuthorizationCode(code);
  if (!authCodeResult.value) {
    return c.json({ error: "invalid_grant" }, 400);
  }

  const authCode = authCodeResult.value;
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
    sid: authCode.userId,
    typ: "ave_fedcm",
    code,
    app_key: appKey || undefined,
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

  const response = await buildTokenResponseFromAuthorizationCode({
    authCode,
    oauthApp,
    clientId,
    redirectUri,
    includeEncryptedAppKey: true,
  });

  return c.json(response);
});

app.get("/session/bootstrap", requireAuth, async (c) => {
  const user = c.get("user")!;

  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, user.id));

  c.header("Cache-Control", "no-store");

  return c.json({
    identities: userIdentities.map((identity) => ({
      id: identity.id,
      displayName: identity.displayName,
      handle: identity.handle,
      email: identity.email,
      birthday: identity.birthday,
      avatarUrl: identity.avatarUrl,
      bannerUrl: identity.bannerUrl,
      isPrimary: identity.isPrimary,
      createdAt: identity.createdAt,
    })),
  });
});


// List user's authorized apps (for dashboard)
app.get("/authorizations", requireAuth, async (c) => {
  const user = c.get("user")!;
  
  const authorizations = await db
    .select({
      id: oauthAuthorizations.id,
      appId: oauthAuthorizations.appId,
      identityId: oauthAuthorizations.identityId,
      createdAt: oauthAuthorizations.createdAt,
      appName: oauthApps.name,
      appIcon: oauthApps.iconUrl,
      appWebsite: oauthApps.websiteUrl,
    })
    .from(oauthAuthorizations)
    .innerJoin(oauthApps, eq(oauthAuthorizations.appId, oauthApps.id))
    .where(eq(oauthAuthorizations.userId, user.id));
  
  return c.json({ authorizations });
});

// Get authorization for a specific app (includes encrypted app key for E2EE)
app.get("/authorization/:clientId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const clientId = c.req.param("clientId") || "";

  // Quick Auth clients (origin: prefix) never have stored authorizations
  if (isQuickClient(clientId)) {
    return c.json({ authorization: null });
  }

  // Find the app
  const [oauthApp] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);
  
  if (!oauthApp) {
    return c.json({ error: "App not found" }, 404);
  }
  
  // Find existing authorization
  const [authorization] = await db
    .select()
    .from(oauthAuthorizations)
    .where(and(
      eq(oauthAuthorizations.userId, user.id),
      eq(oauthAuthorizations.appId, oauthApp.id),
    ))
    .orderBy(desc(oauthAuthorizations.lastAuthorizedAt))
    .limit(1);
  
  if (!authorization) {
    return c.json({ authorization: null });
  }
  
  return c.json({
    authorization: {
      id: authorization.id,
      identityId: authorization.identityId,
      encryptedAppKey: authorization.encryptedAppKey,
      createdAt: authorization.createdAt,
    }
  });
});

// Revoke app authorization
app.delete("/authorizations/:authId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const authId = c.req.param("authId") || "";
  
  const [auth] = await db
    .select()
    .from(oauthAuthorizations)
    .where(and(eq(oauthAuthorizations.id, authId), eq(oauthAuthorizations.userId, user.id)))
    .limit(1);
  
  if (!auth) {
    return c.json({ error: "Authorization not found" }, 404);
  }
  
  await db.delete(oauthAuthorizations).where(eq(oauthAuthorizations.id, authId));
  
  // Get app name for logging
  const [oauthApp] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.id, auth.appId))
    .limit(1);
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "oauth_revoked",
    appId: auth.appId,
    details: {
      appName: oauthApp?.name,
      appId: auth.appId,
      identityId: auth.identityId,
    },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });

  await db.insert(appAnalyticsEvents).values({
    appId: auth.appId,
    identityId: auth.identityId,
    eventType: "authorization_revoked",
    severity: "warning",
    metadata: {},
  });
  
  return c.json({ success: true });
});

// List connector delegations for current user
app.get("/delegations", requireAuth, async (c) => {
  const user = c.get("user")!;

  const delegations = await db
    .select({
      id: oauthDelegationGrants.id,
      createdAt: oauthDelegationGrants.createdAt,
      updatedAt: oauthDelegationGrants.updatedAt,
      revokedAt: oauthDelegationGrants.revokedAt,
      communicationMode: oauthDelegationGrants.communicationMode,
      scope: oauthDelegationGrants.scope,
      sourceAppClientId: oauthApps.clientId,
      sourceAppName: oauthApps.name,
      sourceAppIconUrl: oauthApps.iconUrl,
      sourceAppWebsiteUrl: oauthApps.websiteUrl,
      targetResourceKey: oauthResources.resourceKey,
      targetResourceName: oauthResources.displayName,
      targetAudience: oauthResources.audience,
    })
    .from(oauthDelegationGrants)
    .innerJoin(oauthApps, eq(oauthDelegationGrants.sourceAppId, oauthApps.id))
    .innerJoin(oauthResources, eq(oauthDelegationGrants.targetResourceId, oauthResources.id))
    .where(eq(oauthDelegationGrants.userId, user.id));

  return c.json({ delegations });
});

// Revoke connector delegation
app.delete("/delegations/:delegationId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const delegationId = c.req.param("delegationId") || "";

  const [grant] = await db
    .select()
    .from(oauthDelegationGrants)
    .where(and(eq(oauthDelegationGrants.id, delegationId), eq(oauthDelegationGrants.userId, user.id), isNull(oauthDelegationGrants.revokedAt)))
    .limit(1);

  if (!grant) {
    return c.json({ error: "Delegation not found" }, 404);
  }

  await db.update(oauthDelegationGrants)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(oauthDelegationGrants.id, delegationId));

  await db.insert(oauthDelegationAuditLogs).values({
    grantId: grant.id,
    userId: grant.userId,
    sourceAppId: grant.sourceAppId,
    targetResourceId: grant.targetResourceId,
    eventType: "grant_revoked",
    details: {
      revokedByUserId: user.id,
    },
  });

  return c.json({ success: true });
});

export default app;
