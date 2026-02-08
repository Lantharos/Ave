import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, oauthApps, oauthAuthorizations, oauthRefreshTokens, identities, activityLogs } from "../db";
import { requireAuth } from "../middleware/auth";
import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { hashSessionToken } from "../lib/crypto";
import { getIssuer, getResourceAudience, getJwtPublicJwk, signJwt, verifyJwt, hashToken } from "../lib/oidc";


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


// In-memory store for authorization codes (in production, use Redis)
const authorizationCodes = new Map<string, {
  userId: string;
  appId: string;
  identityId: string;
  redirectUri: string;
  scope: string;
  expiresAt: number;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  encryptedAppKey?: string; // E2EE: encrypted app key to return to the app
  nonce?: string;
}>();


function getDiscoveryBase(): string {
  return process.env.OIDC_DISCOVERY_BASE || "https://api.aveid.net";
}

// In-memory access token store (replace with Redis in production)
const accessTokens = new Map<string, {
  userId: string;
  identityId: string;
  appId: string;
  scope: string;
  expiresAt: number;
  redirectUri: string;
  nonce?: string;
}>();

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

function hasScope(scope: string, requested: string): boolean {
  return parseScopes(scope).includes(requested);
}


// Public: Get OAuth app info (for authorization screen)
app.get("/app/:clientId", async (c) => {
  const clientId = c.req.param("clientId");
  
  const [oauthApp] = await db
    .select({
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
  
  return c.json({ app: oauthApp });
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
})), async (c) => {
  const user = c.get("user")!;
  const { clientId, redirectUri, scope, state, identityId, codeChallenge, codeChallengeMethod, encryptedAppKey, nonce } = c.req.valid("json");

  
  // Find the OAuth app
  const [oauthApp] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);
  
  if (!oauthApp) {
    return c.json({ error: "Invalid client_id" }, 400);
  }
  
  // Validate redirect URI
  const allowedUris = oauthApp.redirectUris as string[];
  if (!allowedUris.includes(redirectUri)) {
    return c.json({ error: "Invalid redirect_uri" }, 400);
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
  
  // Check if already authorized
  const [existingAuth] = await db
    .select()
    .from(oauthAuthorizations)
    .where(and(
      eq(oauthAuthorizations.userId, user.id),
      eq(oauthAuthorizations.appId, oauthApp.id),
      eq(oauthAuthorizations.identityId, identityId),
    ))
    .limit(1);
  
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
      encryptedAppKey: encryptedAppKey || null,
    });
  } else if (oauthApp.supportsE2ee && !existingAuth.encryptedAppKey && encryptedAppKey) {
    // If existing auth doesn't have an app key but we're providing one now, update it
    await db.update(oauthAuthorizations)
      .set({ encryptedAppKey })
      .where(eq(oauthAuthorizations.id, existingAuth.id));
  }
  
  // Generate authorization code
  const code = generateAuthCode();
  
  // Get the encrypted app key to include in the auth code
  // Either from the new authorization or from an existing one
  const finalEncryptedAppKey = encryptedAppKey || existingAuth?.encryptedAppKey || undefined;
  
  authorizationCodes.set(code, {
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
  });

  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "oauth_authorized",
    details: { appName: oauthApp.name, appId: oauthApp.id },
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
])), async (c) => {
  const payload = c.req.valid("json");
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
        .where(and(eq(oauthRefreshTokens.appId, oauthApp.id), eq(oauthRefreshTokens.revokedAt, null)));
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
    accessTokens.set(accessToken, {
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
  const authCode = authorizationCodes.get(code);
  if (!authCode) {
    return c.json({ error: "invalid_grant", error_description: "Authorization code not found" }, 400);
  }
  
  if (Date.now() > authCode.expiresAt) {
    authorizationCodes.delete(code);
    return c.json({ error: "invalid_grant", error_description: "Authorization code expired" }, 400);
  }
  
  if (authCode.redirectUri !== redirectUri) {
    return c.json({ error: "invalid_grant", error_description: "Redirect URI mismatch" }, 400);
  }
  
  // Find OAuth app
  const [oauthApp] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);
  
  if (!oauthApp) {
    return c.json({ error: "invalid_client", error_description: "Client not found" }, 400);
  }
  
  // Verify client secret or PKCE code verifier
  if (authCode.codeChallenge) {
    // PKCE flow
    if (!codeVerifier) {
      return c.json({ error: "invalid_request", error_description: "Code verifier required" }, 400);
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
    
    if (computedChallenge !== authCode.codeChallenge) {
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

  
  // Delete used code
  authorizationCodes.delete(code);
  
  // Generate access token
  const accessToken = generateAccessToken();
  const accessTokenTtl = oauthApp.accessTokenTtlSeconds || 3600;
  const refreshTokenTtl = oauthApp.refreshTokenTtlSeconds || 30 * 24 * 60 * 60;

  accessTokens.set(accessToken, {
    userId: authCode.userId,
    identityId: authCode.identityId,
    appId: authCode.appId,
    scope: authCode.scope,
    expiresAt: Date.now() + accessTokenTtl * 1000,
    redirectUri,
  });
  
  // Get identity info
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.id, authCode.identityId))
    .limit(1);

  const subject = authCode.identityId;
  const issuedAt = nowSeconds();
  const expiresAt = issuedAt + accessTokenTtl;
  
  // Build response
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

  if (hasScope(authCode.scope, "offline_access")) {
    const refreshToken = generateRefreshToken();
    await db.insert(oauthRefreshTokens).values({
      userId: authCode.userId,
      identityId: authCode.identityId,
      appId: authCode.appId,
      tokenHash: hashToken(refreshToken),
      scope: authCode.scope,
      expiresAt: new Date(Date.now() + refreshTokenTtl * 1000),
    });
    response.refresh_token = refreshToken;
  }
  
  // Include encrypted app key for E2EE apps
  if (oauthApp.supportsE2ee && authCode.encryptedAppKey) {
    response.encrypted_app_key = authCode.encryptedAppKey;
  }
  
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
    grant_types_supported: ["authorization_code", "refresh_token"],
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
  let record = accessTokens.get(token);

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

  if (Date.now() > record.expiresAt) {
    accessTokens.delete(token);
    return c.json({ error: "invalid_token" }, 401);
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
  const clientId = c.req.param("clientId");
  
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
  const authId = c.req.param("authId");
  
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
    details: { appName: oauthApp?.name, appId: auth.appId },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });
  
  return c.json({ success: true });
});

export default app;
