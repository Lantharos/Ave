import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  db,
  identities,
  oauthApps,
  oauthAuthorizations,
  oauthDelegationGrants,
  oauthResources,
  organizationEncryptionPolicies,
  organizationIdentityMembers,
  organizations,
} from "../../db";
import { recordActivityLog, recordAppAnalyticsEvent, recordOAuthDelegationAuditLog } from "../../lib/background-events";
import { serializeEncryptionPolicy } from "../../lib/business-encryption";
import { createBusinessOrganization } from "../../lib/business";
import { serializeIdentityForOwner } from "../../lib/identity-serialization";
import { getIssuer, getResourceAudience, verifyJwt } from "../../lib/oidc";
import { getAccessToken } from "../../lib/oauth-store";
import { enforceRateLimits, ipRateLimit, subjectRateLimit } from "../../lib/rate-limit";
import { requireAuth, requireWritable } from "../../middleware/auth";
import {
  hasScope,
  isQuickClient,
  organizationResponse,
  resolveAccessTokenRecord,
  resolveOauthAppForAccessRecord,
  workspaceOrganizationResponse,
} from "./shared";

const app = new Hono();

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  client_id: z.string().optional(),
  clientId: z.string().optional(),
  userConfirmedAveWorkspaceCreation: z.literal(true),
});

app.get("/userinfo", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "oauth:userinfo:ip", 300, 60 * 1000),
    subjectRateLimit("oauth:userinfo:token", token.slice(0, 32), 180, 60 * 1000),
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

  if (hasScope(record.scope, "user_id") && record.userId) {
    response.user_id = record.userId;
  }

  if (record.organizationId) {
    let organizationName = record.organizationName;
    if (!organizationName) {
      const [organization] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, record.organizationId)).limit(1);
      organizationName = organization?.name;
    }
    response.organization = organizationResponse({ ...record, organizationName });
  }

  response.iss = getIssuer();

  return c.json(response);
});

app.get("/organizations", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "oauth:organizations:ip", 180, 60 * 1000),
    subjectRateLimit("oauth:organizations:token", token.slice(0, 32), 120, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  const record = await resolveAccessTokenRecord(token);
  if (!record) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const requestedClientId = c.req.query("client_id");
  if (requestedClientId) {
    const oauthApp = await resolveOauthAppForAccessRecord(record);
    if (!oauthApp || oauthApp.clientId !== requestedClientId) {
      return c.json({ error: "invalid_client", error_description: "Token does not belong to that client" }, 403);
    }
  }

  const memberships = await db
    .select({ member: organizationIdentityMembers, organization: organizations })
    .from(organizationIdentityMembers)
    .innerJoin(organizations, eq(organizations.id, organizationIdentityMembers.organizationId))
    .where(and(
      eq(organizationIdentityMembers.identityId, record.identityId),
      eq(organizationIdentityMembers.status, "active"),
    ))
    .orderBy(desc(organizationIdentityMembers.updatedAt));

  const organizationIds = memberships.map((membership) => membership.organization.id);
  const policyRows = organizationIds.length
    ? await db.select().from(organizationEncryptionPolicies).where(inArray(organizationEncryptionPolicies.organizationId, organizationIds))
    : [];
  const policyByOrganizationId = new Map(policyRows.map((policy) => [policy.organizationId, policy]));

  return c.json({
    organizations: memberships.map(({ member, organization }) => {
      const encryptionPolicy = serializeEncryptionPolicy(policyByOrganizationId.get(organization.id) ?? null, organization.id);
      return workspaceOrganizationResponse(organization, member, encryptionPolicy);
    }),
  });
});

app.post("/workspaces", zValidator("json", createWorkspaceSchema), async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const body = c.req.valid("json");
  const requestedClientId = body.clientId ?? body.client_id;
  if (body.clientId && body.client_id && body.clientId !== body.client_id) {
    return c.json({ error: "invalid_request", error_description: "clientId and client_id must match" }, 400);
  }

  const token = authHeader.slice(7);
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "oauth:workspaces-create:ip", 30, 60 * 1000),
    subjectRateLimit("oauth:workspaces-create:token", token.slice(0, 32), 10, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  const record = await resolveAccessTokenRecord(token);
  if (!record) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const oauthApp = await resolveOauthAppForAccessRecord(record);
  if (!oauthApp) {
    return c.json({ error: "invalid_client", error_description: "Workspace creation requires a registered Ave app token" }, 403);
  }
  if (requestedClientId && oauthApp.clientId !== requestedClientId) {
    return c.json({ error: "invalid_client", error_description: "Token does not belong to that client" }, 403);
  }

  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.id, record.identityId))
    .limit(1);

  if (!identity) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const identityRateLimit = await enforceRateLimits(c, [
    subjectRateLimit("oauth:workspaces-create:identity", identity.id, 5, 60 * 1000),
  ]);
  if (identityRateLimit) return identityRateLimit;

  const created = await createBusinessOrganization(identity.userId, body.name, identity.id);
  if (!created) {
    return c.json({ error: "workspace_creation_failed" }, 400);
  }

  const encryptionPolicy = serializeEncryptionPolicy(null, created.organization.id);
  const organization = workspaceOrganizationResponse(created.organization, created.member, encryptionPolicy);

  recordActivityLog(c, {
    userId: identity.userId,
    action: "oauth_workspace_created",
    appId: oauthApp?.id,
    details: {
      organizationId: created.organization.id,
      organizationName: created.organization.name,
      identityId: identity.id,
      clientId: oauthApp?.clientId ?? requestedClientId,
      source: "oauth_workspace_endpoint",
    },
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({ organization }, 201);
});


// Session check endpoint — used by Quick Ave session monitor.
app.post("/session/check", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "invalid_token", reason: "invalid_token" }, 401);
  }

  const token = authHeader.slice(7);
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "oauth:session-check:ip", 300, 60 * 1000),
    subjectRateLimit("oauth:session-check:token", token.slice(0, 32), 120, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

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
app.get("/session/bootstrap", requireAuth, async (c) => {
  const user = c.get("user")!;

  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, user.id));

  c.header("Cache-Control", "no-store");

  return c.json({
    readOnly: user.isReadOnly,
    identities: userIdentities.map(serializeIdentityForOwner),
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
