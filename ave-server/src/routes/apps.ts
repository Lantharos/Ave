import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  activityLogs,
  db,
  identities,
  oauthApps,
  oauthAuthorizations,
  oauthDelegationAuditLogs,
  oauthDelegationGrants,
  oauthRefreshTokens,
  oauthResources,
} from "../db";
import { generateRandomId, hashSessionToken } from "../lib/crypto";
import { verifyJwt, getResourceAudience } from "../lib/oidc";
import {
  backfillOwnedAppsOrganization,
  ensurePersonalOrganization,
  getAccessibleApp,
  getAccessibleApps,
  requireOrganizationAccess,
} from "../lib/dev-portal";

declare module "hono" {
  interface ContextVariableMap {
    devUserId: string;
    devAuthMethod?: string | null;
  }
}

const app = new Hono();

const allowedScopes = ["openid", "profile", "email", "offline_access", "user_id"] as const;

const baseAppSchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().max(200).optional(),
  websiteUrl: z.string().url().optional(),
  iconUrl: z.string().url().optional(),
  redirectUris: z.array(z.string().url()).min(1),
  supportsE2ee: z.boolean().default(false),
  allowedScopes: z.array(z.enum(allowedScopes)).default(["openid", "profile", "email", "offline_access"]),
  accessTokenTtlSeconds: z.number().int().min(300).max(86400).optional(),
  refreshTokenTtlSeconds: z.number().int().min(3600).max(60 * 60 * 24 * 365).optional(),
  allowUserIdScope: z.boolean().optional(),
  organizationId: z.string().uuid().optional(),
});

const resourceSchema = z.object({
  resourceKey: z.string().min(3).max(100).regex(/^[a-z0-9:_-]+$/),
  displayName: z.string().min(2).max(80),
  description: z.string().max(240).optional(),
  scopes: z.array(z.string().min(2).max(80)).min(1),
  audience: z.string().min(3).max(200),
  status: z.enum(["active", "disabled"]).optional(),
});

function serializeResource(resource: typeof oauthResources.$inferSelect) {
  return {
    id: resource.id,
    resourceKey: resource.resourceKey,
    displayName: resource.displayName,
    description: resource.description,
    scopes: resource.scopes as string[],
    audience: resource.audience,
    status: resource.status,
  };
}

function serializeApp(
  appRow: typeof oauthApps.$inferSelect,
  resources: (typeof oauthResources.$inferSelect)[],
) {
  return {
    id: appRow.id,
    clientId: appRow.clientId,
    name: appRow.name,
    description: appRow.description,
    websiteUrl: appRow.websiteUrl,
    iconUrl: appRow.iconUrl,
    redirectUris: appRow.redirectUris as string[],
    supportsE2ee: !!appRow.supportsE2ee,
    allowedScopes: appRow.allowedScopes as string[],
    accessTokenTtlSeconds: appRow.accessTokenTtlSeconds,
    refreshTokenTtlSeconds: appRow.refreshTokenTtlSeconds,
    allowUserIdScope: !!appRow.allowUserIdScope,
    createdAt: appRow.createdAt,
    organizationId: appRow.organizationId,
    resources: resources.map(serializeResource),
  };
}

function isResourceKeyUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("unique") && message.includes("oauth_resources.resource_key");
}

async function requireDevUser(c: any, next: any) {
  const authHeader = c.req.header("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = await verifyJwt(token, getResourceAudience());

      if (payload) {
        const userId = (payload.uid || payload.sid) as string | undefined;
        if (userId) {
          c.set("devUserId", userId);
          c.set("devAuthMethod", null);
          return next();
        }
      }
    } catch {}
  }

  const sessionUser = c.get("user");
  if (sessionUser?.id) {
    c.set("devUserId", sessionUser.id);
    c.set("devAuthMethod", sessionUser.authMethod || null);
    return next();
  }

  return c.json({ error: "Unauthorized" }, 401);
}

async function listAppResources(appIds: string[]) {
  if (!appIds.length) return [];
  return db
    .select()
    .from(oauthResources)
    .where(inArray(oauthResources.ownerAppId, appIds));
}

app.use("*", requireDevUser);

app.get("/", async (c) => {
  const userId = c.get("devUserId") as string;
  await backfillOwnedAppsOrganization(userId);

  const requestedOrganizationId = c.req.query("organizationId");
  const apps = await getAccessibleApps(userId, requestedOrganizationId);
  const resources = await listAppResources(apps.map((appRow) => appRow.id));

  const resourcesByAppId = new Map<string, typeof resources>();
  for (const resource of resources) {
    const list = resourcesByAppId.get(resource.ownerAppId) || [];
    list.push(resource);
    resourcesByAppId.set(resource.ownerAppId, list);
  }

  return c.json({
    apps: apps.map((appRow) => serializeApp(appRow, resourcesByAppId.get(appRow.id) || [])),
  });
});

app.post("/", zValidator("json", baseAppSchema), async (c) => {
  const userId = c.get("devUserId") as string;
  const data = c.req.valid("json");
  const personalOrganization = await ensurePersonalOrganization(userId);
  const organizationId = data.organizationId || personalOrganization.id;

  const membership = await requireOrganizationAccess(userId, organizationId, "admin");
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const clientId = `app_${generateRandomId(32)}`;
  const clientSecret = generateRandomId(48);
  const clientSecretHash = hashSessionToken(clientSecret);

  const [newApp] = await db
    .insert(oauthApps)
    .values({
      name: data.name,
      description: data.description || null,
      websiteUrl: data.websiteUrl || null,
      iconUrl: data.iconUrl || null,
      redirectUris: data.redirectUris,
      supportsE2ee: data.supportsE2ee,
      allowedScopes: data.allowedScopes,
      accessTokenTtlSeconds: data.accessTokenTtlSeconds || 3600,
      refreshTokenTtlSeconds: data.refreshTokenTtlSeconds || 30 * 24 * 60 * 60,
      allowUserIdScope: data.allowUserIdScope ?? false,
      clientId,
      clientSecretHash,
      ownerId: userId,
      organizationId,
    })
    .returning();

  return c.json({
    app: serializeApp(newApp, []),
    clientSecret,
  });
});

app.get("/:appId/insights", async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");

  const accessible = await getAccessibleApp(userId, appId, "viewer");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }

  const [authorizations, refreshTokens, allLogs, delegations, resources] = await Promise.all([
    db.select().from(oauthAuthorizations).where(eq(oauthAuthorizations.appId, appId)),
    db.select().from(oauthRefreshTokens).where(eq(oauthRefreshTokens.appId, appId)),
    db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)),
    db.select().from(oauthDelegationGrants).where(and(eq(oauthDelegationGrants.sourceAppId, appId), isNull(oauthDelegationGrants.revokedAt))),
    db.select().from(oauthResources).where(eq(oauthResources.ownerAppId, appId)),
  ]);

  const appActivity = allLogs.filter((entry) => (entry.details?.appId as string | undefined) === appId);
  const methodCounts = {
    passkey: 0,
    deviceApproval: 0,
    trustCode: 0,
    unknown: 0,
  };

  for (const log of appActivity) {
    if (log.action !== "oauth_authorized") continue;
    const method = log.details?.authMethod;
    if (method === "passkey") methodCounts.passkey += 1;
    else if (method === "device_approval") methodCounts.deviceApproval += 1;
    else if (method === "trust_code") methodCounts.trustCode += 1;
    else methodCounts.unknown += 1;
  }

  const totalMethodEvents = methodCounts.passkey + methodCounts.deviceApproval + methodCounts.trustCode + methodCounts.unknown;
  const instantRate = totalMethodEvents
    ? Math.round(((methodCounts.passkey + methodCounts.deviceApproval) / totalMethodEvents) * 100)
    : 0;

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const httpsRedirects = (accessible.app.redirectUris as string[]).filter((uri) => uri.startsWith("https://")).length;

  return c.json({
    insights: {
      totalIdentities: new Set(authorizations.map((entry) => entry.identityId)).size,
      totalAuthorizations: authorizations.length,
      weeklyAuthorizations: authorizations.filter((entry) => new Date(entry.createdAt).getTime() >= weekAgo).length,
      activeRefreshTokens: refreshTokens.filter((entry) => !entry.revokedAt && new Date(entry.expiresAt).getTime() > now).length,
      instantSignInRate: instantRate,
      methodCounts,
      redirectSecurityRate: accessible.app.redirectUris.length
        ? Math.round((httpsRedirects / accessible.app.redirectUris.length) * 100)
        : 0,
      resources: resources.length,
      activeDelegations: delegations.length,
      revocations: appActivity.filter((entry) => entry.action === "oauth_revoked").length,
    },
  });
});

app.get("/:appId/identities", async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");

  const accessible = await getAccessibleApp(userId, appId, "viewer");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }

  const authorizations = await db
    .select()
    .from(oauthAuthorizations)
    .where(eq(oauthAuthorizations.appId, appId));

  const identityIds = [...new Set(authorizations.map((entry) => entry.identityId))];
  if (!identityIds.length) {
    return c.json({ identities: [] });
  }

  const [identityRows, refreshTokens, authActivity] = await Promise.all([
    db.select().from(identities).where(inArray(identities.id, identityIds)),
    db.select().from(oauthRefreshTokens).where(and(eq(oauthRefreshTokens.appId, appId), inArray(oauthRefreshTokens.identityId, identityIds))),
    db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)),
  ]);

  const authorizationStats = new Map<string, { firstSeen: Date; lastSeen: Date; authorizations: number }>();
  for (const authorization of authorizations) {
    const createdAt = new Date(authorization.createdAt);
    const existing = authorizationStats.get(authorization.identityId);
    if (!existing) {
      authorizationStats.set(authorization.identityId, {
        firstSeen: createdAt,
        lastSeen: createdAt,
        authorizations: 1,
      });
      continue;
    }

    if (createdAt < existing.firstSeen) existing.firstSeen = createdAt;
    if (createdAt > existing.lastSeen) existing.lastSeen = createdAt;
    existing.authorizations += 1;
  }

  const refreshCountByIdentityId = new Map<string, { count: number; lastActive: Date | null }>();
  for (const token of refreshTokens) {
    const createdAt = new Date(token.createdAt);
    const existing = refreshCountByIdentityId.get(token.identityId) || { count: 0, lastActive: null };
    existing.count += 1;
    if (!existing.lastActive || createdAt > existing.lastActive) {
      existing.lastActive = createdAt;
    }
    refreshCountByIdentityId.set(token.identityId, existing);
  }

  const latestMethodByIdentityId = new Map<string, string>();
  for (const log of authActivity) {
    if (log.action !== "oauth_authorized") continue;
    if ((log.details?.appId as string | undefined) !== appId) continue;
    const identityId = log.details?.identityId;
    const authMethod = log.details?.authMethod;
    if (typeof identityId === "string" && typeof authMethod === "string" && !latestMethodByIdentityId.has(identityId)) {
      latestMethodByIdentityId.set(identityId, authMethod);
    }
  }

  return c.json({
    identities: identityRows.map((identity) => {
      const authorization = authorizationStats.get(identity.id);
      const refresh = refreshCountByIdentityId.get(identity.id);
      return {
        id: identity.id,
        displayName: identity.displayName,
        handle: identity.handle,
        email: identity.email,
        avatarUrl: identity.avatarUrl,
        isPrimary: identity.isPrimary,
        firstSeen: authorization?.firstSeen || identity.createdAt,
        lastActive: refresh?.lastActive || authorization?.lastSeen || identity.createdAt,
        signInCount: (authorization?.authorizations || 0) + (refresh?.count || 0),
        authorizationCount: authorization?.authorizations || 0,
        refreshCount: refresh?.count || 0,
        lastMethod: latestMethodByIdentityId.get(identity.id) || null,
      };
    }),
  });
});

app.get("/:appId/activity", async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");

  const accessible = await getAccessibleApp(userId, appId, "viewer");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }

  const [logs, delegationLogs] = await Promise.all([
    db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)),
    db.select().from(oauthDelegationAuditLogs).where(eq(oauthDelegationAuditLogs.sourceAppId, appId)).orderBy(desc(oauthDelegationAuditLogs.createdAt)),
  ]);

  const appLogs = logs
    .filter((log) => (log.details?.appId as string | undefined) === appId)
    .map((log) => ({
      id: log.id,
      action: log.action,
      details: log.details,
      severity: log.severity,
      createdAt: log.createdAt,
      source: "activity",
    }));

  const delegationEvents = delegationLogs.map((log) => ({
    id: log.id,
    action: log.eventType,
    details: log.details,
    severity: "info",
    createdAt: log.createdAt,
    source: "delegation",
  }));

  const events = [...appLogs, ...delegationEvents].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return c.json({ events });
});

app.patch("/:appId", zValidator("json", baseAppSchema.partial()), async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");
  const data = c.req.valid("json");

  const accessible = await getAccessibleApp(userId, appId, "admin");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }

  let nextOrganizationId = accessible.app.organizationId;
  if (data.organizationId && data.organizationId !== accessible.app.organizationId) {
    const destination = await requireOrganizationAccess(userId, data.organizationId, "admin");
    if (!destination) {
      return c.json({ error: "Organization not found" }, 404);
    }
    nextOrganizationId = data.organizationId;
  }

  const [updated] = await db
    .update(oauthApps)
    .set({
      name: data.name ?? accessible.app.name,
      description: data.description ?? accessible.app.description,
      websiteUrl: data.websiteUrl ?? accessible.app.websiteUrl,
      iconUrl: data.iconUrl ?? accessible.app.iconUrl,
      redirectUris: data.redirectUris ?? (accessible.app.redirectUris as string[]),
      supportsE2ee: data.supportsE2ee ?? accessible.app.supportsE2ee,
      allowedScopes: data.allowedScopes ?? (accessible.app.allowedScopes as string[]),
      accessTokenTtlSeconds: data.accessTokenTtlSeconds ?? accessible.app.accessTokenTtlSeconds,
      refreshTokenTtlSeconds: data.refreshTokenTtlSeconds ?? accessible.app.refreshTokenTtlSeconds,
      allowUserIdScope: data.allowUserIdScope ?? accessible.app.allowUserIdScope,
      organizationId: nextOrganizationId,
    })
    .where(eq(oauthApps.id, appId))
    .returning();

  const resources = await listAppResources([updated.id]);
  return c.json({ app: serializeApp(updated, resources) });
});

app.delete("/:appId", async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");

  const accessible = await getAccessibleApp(userId, appId, "admin");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }

  await db.delete(oauthApps).where(eq(oauthApps.id, appId));
  return c.json({ success: true });
});

app.post("/:appId/rotate-secret", async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");

  const accessible = await getAccessibleApp(userId, appId, "admin");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }

  const clientSecret = generateRandomId(48);
  const clientSecretHash = hashSessionToken(clientSecret);

  await db
    .update(oauthApps)
    .set({ clientSecretHash })
    .where(eq(oauthApps.id, appId));

  return c.json({ clientSecret });
});

app.get("/:appId/resources", async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");

  const accessible = await getAccessibleApp(userId, appId, "viewer");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }

  const resources = await db
    .select()
    .from(oauthResources)
    .where(eq(oauthResources.ownerAppId, appId));

  return c.json({ resources: resources.map(serializeResource) });
});

app.post("/:appId/resources", zValidator("json", resourceSchema), async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");
  const data = c.req.valid("json");

  const accessible = await getAccessibleApp(userId, appId, "admin");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }

  const [resourceWithSameKey] = await db
    .select({ id: oauthResources.id })
    .from(oauthResources)
    .where(eq(oauthResources.resourceKey, data.resourceKey))
    .limit(1);

  if (resourceWithSameKey) {
    return c.json({ error: "Resource key already exists" }, 409);
  }

  let created: typeof oauthResources.$inferSelect;
  try {
    [created] = await db
      .insert(oauthResources)
      .values({
        ownerAppId: appId,
        resourceKey: data.resourceKey,
        displayName: data.displayName,
        description: data.description || null,
        scopes: data.scopes,
        audience: data.audience,
        status: data.status || "active",
      })
      .returning();
  } catch (error) {
    if (isResourceKeyUniqueViolation(error)) {
      return c.json({ error: "Resource key already exists" }, 409);
    }
    throw error;
  }

  return c.json({ resource: serializeResource(created) });
});

app.patch("/:appId/resources/:resourceId", zValidator("json", resourceSchema.partial()), async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");
  const resourceId = c.req.param("resourceId");
  const data = c.req.valid("json");

  const accessible = await getAccessibleApp(userId, appId, "admin");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }

  const [resource] = await db
    .select()
    .from(oauthResources)
    .where(and(eq(oauthResources.id, resourceId), eq(oauthResources.ownerAppId, appId)))
    .limit(1);

  if (!resource) {
    return c.json({ error: "Resource not found" }, 404);
  }

  const nextResourceKey = data.resourceKey ?? resource.resourceKey;
  const [resourceWithSameKey] = await db
    .select({ id: oauthResources.id })
    .from(oauthResources)
    .where(eq(oauthResources.resourceKey, nextResourceKey))
    .limit(1);

  if (resourceWithSameKey && resourceWithSameKey.id !== resourceId) {
    return c.json({ error: "Resource key already exists" }, 409);
  }

  let updated: typeof oauthResources.$inferSelect;
  try {
    [updated] = await db
      .update(oauthResources)
      .set({
        resourceKey: nextResourceKey,
        displayName: data.displayName ?? resource.displayName,
        description: data.description ?? resource.description,
        scopes: data.scopes ?? (resource.scopes as string[]),
        audience: data.audience ?? resource.audience,
        status: data.status ?? resource.status,
        updatedAt: new Date(),
      })
      .where(eq(oauthResources.id, resourceId))
      .returning();
  } catch (error) {
    if (isResourceKeyUniqueViolation(error)) {
      return c.json({ error: "Resource key already exists" }, 409);
    }
    throw error;
  }

  return c.json({ resource: serializeResource(updated) });
});

app.delete("/:appId/resources/:resourceId", async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");
  const resourceId = c.req.param("resourceId");

  const accessible = await getAccessibleApp(userId, appId, "admin");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }

  const [resource] = await db
    .select()
    .from(oauthResources)
    .where(and(eq(oauthResources.id, resourceId), eq(oauthResources.ownerAppId, appId)))
    .limit(1);

  if (!resource) {
    return c.json({ error: "Resource not found" }, 404);
  }

  await db.delete(oauthResources).where(eq(oauthResources.id, resourceId));
  return c.json({ success: true });
});

export default app;
