import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, oauthApps, oauthAuthorizations, identities, activityLogs, sessions, devices } from "../db";
import { requireAuth } from "../middleware/auth";
import { eq, and } from "drizzle-orm";
import { generateSessionToken, hashSessionToken } from "../lib/crypto";

const app = new Hono();

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
}>();

// Generate authorization code
function generateAuthCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

// Generate access token
function generateAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
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
})), async (c) => {
  const user = c.get("user")!;
  const { clientId, redirectUri, scope, state, identityId, codeChallenge, codeChallengeMethod, encryptedAppKey } = c.req.valid("json");
  
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
app.post("/token", zValidator("json", z.object({
  grantType: z.literal("authorization_code"),
  code: z.string(),
  redirectUri: z.string().url(),
  clientId: z.string(),
  clientSecret: z.string().optional(),
  codeVerifier: z.string().optional(), // PKCE
})), async (c) => {
  const { grantType, code, redirectUri, clientId, clientSecret, codeVerifier } = c.req.valid("json");
  
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
  
  // Delete used code
  authorizationCodes.delete(code);
  
  // Generate access token
  const accessToken = generateAccessToken();
  
  // Get identity info
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.id, authCode.identityId))
    .limit(1);
  
  // Build response
  const response: Record<string, unknown> = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600, // 1 hour
    scope: authCode.scope,
    user: identity ? {
      id: identity.id,
      handle: identity.handle,
      displayName: identity.displayName,
      email: identity.email,
      avatarUrl: identity.avatarUrl,
    } : null,
  };
  
  // Include encrypted app key for E2EE apps
  if (oauthApp.supportsE2ee && authCode.encryptedAppKey) {
    response.encrypted_app_key = authCode.encryptedAppKey;
  }
  
  return c.json(response);
});

// User info endpoint - get current user info
app.get("/userinfo", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }
  
  // In a real implementation, you'd validate the access token
  // and look up the associated user/identity
  // For now, this is a placeholder
  return c.json({ error: "Access token validation not implemented" }, 501);
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
