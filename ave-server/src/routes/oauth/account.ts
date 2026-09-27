import { and, desc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import {
  db,
  identities,
  oauthApps,
  oauthAuthorizations,
  oauthDelegationGrants,
  oauthResources,
} from "../../db";
import { recordActivityLog, recordAppAnalyticsEvent, recordOAuthDelegationAuditLog } from "../../lib/platform/background-events";
import { identityClaimsForApp, listIdentitiesForOwner } from "../../lib/identity/identity-serialization";
import { getIssuer } from "../../lib/oauth/oidc";
import { enforceNativeRateLimits, getClientIp, ipRateLimit, subjectRateLimit } from "../../lib/platform/rate-limit";
import { requireAuth, requireWritable } from "../../middleware/auth";
import {
  hasScope,
  isQuickClient,
  resolveAccessTokenRecord,
} from "./shared";

const app = new Hono();

app.get("/userinfo", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const rateLimitResponse = await enforceNativeRateLimits(c, [
    {
      binding: "OAUTH_TOKEN_IP_RATE_LIMITER",
      key: `userinfo:ip:${getClientIp(c)}`,
      periodSeconds: 60,
      fallback: ipRateLimit(c, "oauth:userinfo:ip", 300, 60 * 1000),
    },
    {
      binding: "OAUTH_CLIENT_RATE_LIMITER",
      key: `userinfo:token:${token.slice(0, 32)}`,
      periodSeconds: 60,
      fallback: subjectRateLimit("oauth:userinfo:token", token.slice(0, 32), 180, 60 * 1000),
    },
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  const record = await resolveAccessTokenRecord(token);
  if (!record) {
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

  const response: Record<string, unknown> = identityClaimsForApp(identity, record.scope);

  if (hasScope(record.scope, "user_id") && record.userId) {
    response.user_id = record.userId;
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
  const rateLimitResponse = await enforceNativeRateLimits(c, [
    {
      binding: "OAUTH_TOKEN_IP_RATE_LIMITER",
      key: `session-check:ip:${getClientIp(c)}`,
      periodSeconds: 60,
      fallback: ipRateLimit(c, "oauth:session-check:ip", 300, 60 * 1000),
    },
    {
      binding: "OAUTH_AUTHORIZE_ACTOR_RATE_LIMITER",
      key: `session-check:token:${token.slice(0, 32)}`,
      periodSeconds: 60,
      fallback: subjectRateLimit("oauth:session-check:token", token.slice(0, 32), 120, 60 * 1000),
    },
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  const record = await resolveAccessTokenRecord(token);
  return record
    ? c.json({ status: "active" })
    : c.json({ error: "invalid_token", reason: "invalid_token" }, 401);
});
app.get("/session/bootstrap", requireAuth, async (c) => {
  const user = c.get("user")!;

  const userIdentities = await listIdentitiesForOwner(user.id);

  c.header("Cache-Control", "no-store");

  return c.json({
    readOnly: user.isReadOnly,
    identities: userIdentities,
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
      scope: authorization.scope,
      identityId: authorization.identityId,
      encryptedAppKey: authorization.encryptedAppKey,
      appPublicKey: authorization.appPublicKey,
      encryptedAppPrivateKey: authorization.encryptedAppPrivateKey,
      appEncryptionMode: authorization.appEncryptionMode,
      createdAt: authorization.createdAt,
    }
  });
});

// Revoke app authorization
app.delete("/authorizations/:authId", requireAuth, requireWritable, async (c) => {
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

  recordActivityLog(c, {
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

  recordAppAnalyticsEvent(c, {
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
app.delete("/delegations/:delegationId", requireAuth, requireWritable, async (c) => {
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

  recordOAuthDelegationAuditLog(c, {
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
