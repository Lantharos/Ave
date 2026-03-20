import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";
import {
  appAnalyticsEvents,
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

const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
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
  identityCount = 0,
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
    identityCount,
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

async function getAppInsights(appId: string, redirectUris: string[]) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const [authorizationRows, weeklyAuthorizations, refreshTokens, analyticsCount, revocations, delegations, resources] = await Promise.all([
    db
      .select({
        lastAuthMethod: oauthAuthorizations.lastAuthMethod,
        authorizationCount: oauthAuthorizations.authorizationCount,
      })
      .from(oauthAuthorizations)
      .where(eq(oauthAuthorizations.appId, appId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthAuthorizations)
      .where(and(eq(oauthAuthorizations.appId, appId), gte(oauthAuthorizations.lastAuthorizedAt, weekAgo))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthRefreshTokens)
      .where(and(eq(oauthRefreshTokens.appId, appId), isNull(oauthRefreshTokens.revokedAt), gt(oauthRefreshTokens.expiresAt, now))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(appAnalyticsEvents)
      .where(eq(appAnalyticsEvents.appId, appId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(appAnalyticsEvents)
      .where(and(eq(appAnalyticsEvents.appId, appId), eq(appAnalyticsEvents.eventType, "authorization_revoked"))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthDelegationGrants)
      .where(and(eq(oauthDelegationGrants.sourceAppId, appId), isNull(oauthDelegationGrants.revokedAt))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthResources)
      .where(eq(oauthResources.ownerAppId, appId)),
  ]);

  const methodCounts = {
    passkey: 0,
    deviceApproval: 0,
    trustCode: 0,
    unknown: 0,
  };

  for (const authorization of authorizationRows) {
    const method = authorization.lastAuthMethod;
    if (method === "passkey") methodCounts.passkey += 1;
    else if (method === "instant") methodCounts.deviceApproval += 1;
    else if (method === "fallback" || method === "trust_code" || method === "device_approval") methodCounts.trustCode += 1;
    else methodCounts.unknown += 1;
  }

  const totalMethodEvents = methodCounts.passkey + methodCounts.deviceApproval + methodCounts.trustCode + methodCounts.unknown;
  const instantRate = totalMethodEvents
    ? Math.round(((methodCounts.passkey + methodCounts.deviceApproval) / totalMethodEvents) * 100)
    : 0;

  const httpsRedirects = redirectUris.filter((uri) => uri.startsWith("https://")).length;

  return {
    totalIdentities: authorizationRows.length,
    totalAuthorizations: authorizationRows.reduce((total, entry) => total + (entry.authorizationCount || 0), 0),
    weeklyAuthorizations: weeklyAuthorizations[0]?.count || 0,
    activeRefreshTokens: refreshTokens[0]?.count || 0,
    instantSignInRate: instantRate,
    methodCounts,
    redirectSecurityRate: redirectUris.length ? Math.round((httpsRedirects / redirectUris.length) * 100) : 0,
    resources: resources[0]?.count || 0,
    activeDelegations: delegations[0]?.count || 0,
    revocations: revocations[0]?.count || 0,
    totalActivityEvents: (analyticsCount[0]?.count || 0) + (delegations[0]?.count || 0),
  };
}

async function getAppIdentities(appId: string, limit = 25, offset = 0) {
  const [totalRow, authorizations] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthAuthorizations)
      .where(eq(oauthAuthorizations.appId, appId)),
    db
      .select()
      .from(oauthAuthorizations)
      .where(eq(oauthAuthorizations.appId, appId))
      .orderBy(desc(oauthAuthorizations.lastAuthorizedAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = totalRow[0]?.count || 0;
  const identityIds = authorizations.map((entry) => entry.identityId);
  if (!identityIds.length) {
    return {
      items: [],
      total,
      limit,
      offset,
      hasMore: false,
    };
  }

  const [identityRows, refreshTokens] = await Promise.all([
    db.select().from(identities).where(inArray(identities.id, identityIds)),
    db.select().from(oauthRefreshTokens).where(and(eq(oauthRefreshTokens.appId, appId), inArray(oauthRefreshTokens.identityId, identityIds))),
  ]);

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

  const items = identityRows.map((identity) => {
    const authorization = authorizations.find((entry) => entry.identityId === identity.id);
    const refresh = refreshCountByIdentityId.get(identity.id);
    return {
      id: identity.id,
      displayName: identity.displayName,
      handle: identity.handle,
      email: identity.email,
      avatarUrl: identity.avatarUrl,
      isPrimary: identity.isPrimary,
      firstSeen: authorization?.createdAt || identity.createdAt,
      lastActive: refresh?.lastActive || authorization?.lastAuthorizedAt || identity.createdAt,
      signInCount: (authorization?.authorizationCount || 0) + (refresh?.count || 0),
      authorizationCount: authorization?.authorizationCount || 0,
      refreshCount: refresh?.count || 0,
      lastMethod: authorization?.lastAuthMethod || null,
      };
    })
    .sort((left, right) => new Date(right.lastActive).getTime() - new Date(left.lastActive).getTime());

  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

async function getAppActivity(appId: string, limit = 25, offset = 0) {
  const windowSize = limit + offset;
  const [analyticsEvents, delegationLogs, analyticsCount, delegationCount] = await Promise.all([
    db
      .select()
      .from(appAnalyticsEvents)
      .where(eq(appAnalyticsEvents.appId, appId))
      .orderBy(desc(appAnalyticsEvents.createdAt))
      .limit(windowSize),
    db
      .select()
      .from(oauthDelegationAuditLogs)
      .where(eq(oauthDelegationAuditLogs.sourceAppId, appId))
      .orderBy(desc(oauthDelegationAuditLogs.createdAt))
      .limit(windowSize),
    db
      .select({ count: sql<number>`count(*)` })
      .from(appAnalyticsEvents)
      .where(eq(appAnalyticsEvents.appId, appId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthDelegationAuditLogs)
      .where(eq(oauthDelegationAuditLogs.sourceAppId, appId)),
  ]);

  const appLogs = analyticsEvents.map((event) => ({
    id: event.id,
    action: event.eventType,
    details: event.metadata,
    severity: event.severity,
    createdAt: event.createdAt,
    source: "activity" as const,
  }));

  const delegationEvents = delegationLogs.map((log) => ({
    id: log.id,
    action: log.eventType,
    details: log.details,
    severity: "info" as const,
    createdAt: log.createdAt,
    source: "delegation" as const,
  }));

  const items = [...appLogs, ...delegationEvents].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  ).slice(offset, offset + limit);

  const total = (analyticsCount[0]?.count || 0) + (delegationCount[0]?.count || 0);

  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

app.use("*", requireDevUser);

app.get("/", async (c) => {
  const userId = c.get("devUserId") as string;
  await backfillOwnedAppsOrganization(userId);

  const requestedOrganizationId = c.req.query("organizationId");
  const apps = await getAccessibleApps(userId, requestedOrganizationId);
  const resources = await listAppResources(apps.map((appRow) => appRow.id));
  const authorizations = apps.length
    ? await db
        .select({
          appId: oauthAuthorizations.appId,
          identityId: oauthAuthorizations.identityId,
        })
        .from(oauthAuthorizations)
        .where(inArray(oauthAuthorizations.appId, apps.map((appRow) => appRow.id)))
    : [];

  const resourcesByAppId = new Map<string, typeof resources>();
  for (const resource of resources) {
    const list = resourcesByAppId.get(resource.ownerAppId) || [];
    list.push(resource);
    resourcesByAppId.set(resource.ownerAppId, list);
  }

  const identityIdsByAppId = new Map<string, Set<string>>();
  for (const authorization of authorizations) {
    const existing = identityIdsByAppId.get(authorization.appId) || new Set<string>();
    existing.add(authorization.identityId);
    identityIdsByAppId.set(authorization.appId, existing);
  }

  return c.json({
    apps: apps.map((appRow) =>
      serializeApp(
        appRow,
        resourcesByAppId.get(appRow.id) || [],
        identityIdsByAppId.get(appRow.id)?.size || 0,
      ),
    ),
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
    app: serializeApp(newApp, [], 0),
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
  return c.json({
    insights: await getAppInsights(appId, accessible.app.redirectUris as string[]),
  });
});

app.get("/:appId/identities", zValidator("query", paginationQuerySchema), async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");
  const { limit = 25, offset = 0 } = c.req.valid("query");

  const accessible = await getAccessibleApp(userId, appId, "viewer");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }
  return c.json(await getAppIdentities(appId, limit, offset));
});

app.get("/:appId/activity", zValidator("query", paginationQuerySchema), async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");
  const { limit = 25, offset = 0 } = c.req.valid("query");

  const accessible = await getAccessibleApp(userId, appId, "viewer");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }
  return c.json(await getAppActivity(appId, limit, offset));
});

app.get("/:appId/overview", async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");

  const accessible = await getAccessibleApp(userId, appId, "viewer");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }

  const [insights, identitiesPage, eventsPage] = await Promise.all([
    getAppInsights(appId, accessible.app.redirectUris as string[]),
    getAppIdentities(appId, 5, 0),
    getAppActivity(appId, 8, 0),
  ]);

  return c.json({ insights, identities: identitiesPage.items, events: eventsPage.items });
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
