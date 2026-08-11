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
  isE2eeScope,
  isScopeAllowedForApp,
  PORTAL_APP_SCOPES,
  stripE2eeScopes,
  syncSupportsE2eeFlag,
} from "../lib/e2ee-scopes";
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

const allowedScopes = PORTAL_APP_SCOPES;

const baseAppSchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().max(200).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  iconUrl: z.string().url().nullable().optional(),
  redirectUris: z.array(z.string().url()).min(1),
  developmentMode: z.boolean().default(false),
  supportsE2ee: z.boolean().default(false).optional(),
  allowedScopes: z.array(z.enum(allowedScopes)).default(["openid", "profile", "email", "offline_access"]),
  accessTokenTtlSeconds: z.number().int().min(300).max(86400).optional(),
  refreshTokenTtlSeconds: z.number().int().min(3600).max(60 * 60 * 24 * 365).optional(),
  organizationId: z.string().min(1).optional(),
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

type AppActivityRow = {
  id: string;
  action: string;
  details: string | Record<string, unknown> | null;
  severity: string;
  createdAt: number | string | Date;
  source: "activity" | "delegation";
};

function parseActivityDetails(details: AppActivityRow["details"]): Record<string, unknown> | null {
  if (!details) return null;
  if (typeof details === "object") return details;
  try {
    return JSON.parse(details) as Record<string, unknown>;
  } catch {
    return null;
  }
}

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

export function serializeApp(
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
    developmentMode: !!appRow.developmentMode,
    supportsE2ee: !!appRow.supportsE2ee,
    allowedScopes: stripE2eeScopes(appRow.allowedScopes as string[]),
    accessTokenTtlSeconds: appRow.accessTokenTtlSeconds,
    refreshTokenTtlSeconds: appRow.refreshTokenTtlSeconds,
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
        const devPortalClientId = process.env.DEV_PORTAL_CLIENT_ID;
        const userId = typeof payload.uid === "string" ? payload.uid : null;
        const tokenClientId = typeof payload.cid === "string" ? payload.cid : "";
        const tokenScopes = typeof payload.scope === "string" ? payload.scope.split(/\s+/).filter(Boolean) : [];
        if (devPortalClientId && tokenClientId === devPortalClientId && userId && tokenScopes.includes("user_id") && payload.quick !== true) {
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

async function requireWritableDevUser(c: any, next: any) {
  const sessionUser = c.get("user");
  if (sessionUser?.isReadOnly) {
    return c.json({ error: "Demo account is read-only" }, 403);
  }

  return next();
}

export async function listAppResources(appIds: string[]) {
  if (!appIds.length) return [];
  return db
    .select()
    .from(oauthResources)
    .where(inArray(oauthResources.ownerAppId, appIds));
}

async function getAppInsights(appId: string, redirectUris: string[]) {
  const now = Date.now();
  const nowDate = new Date(now);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const [authorizationGroups, weeklyAuthorizations, refreshTokens, analyticsCount, revocations, delegations, resources] = await Promise.all([
    db
      .select({
        lastAuthMethod: oauthAuthorizations.lastAuthMethod,
        identityCount: sql<number>`count(*)`,
        authorizationCount: sql<number>`sum(${oauthAuthorizations.authorizationCount})`,
      })
      .from(oauthAuthorizations)
      .where(eq(oauthAuthorizations.appId, appId))
      .groupBy(oauthAuthorizations.lastAuthMethod),
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthAuthorizations)
      .where(and(eq(oauthAuthorizations.appId, appId), gte(oauthAuthorizations.lastAuthorizedAt, weekAgo))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthRefreshTokens)
      .where(and(eq(oauthRefreshTokens.appId, appId), isNull(oauthRefreshTokens.revokedAt), gt(oauthRefreshTokens.expiresAt, nowDate))),
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

  for (const authorization of authorizationGroups) {
    const count = Number(authorization.identityCount || 0);
    const method = authorization.lastAuthMethod;
    if (method === "passkey") methodCounts.passkey += count;
    else if (method === "instant") methodCounts.deviceApproval += count;
    else if (method === "fallback" || method === "trust_code" || method === "device_approval") methodCounts.trustCode += count;
    else methodCounts.unknown += count;
  }

  const totalMethodEvents = methodCounts.passkey + methodCounts.deviceApproval + methodCounts.trustCode + methodCounts.unknown;
  const instantRate = totalMethodEvents
    ? Math.round(((methodCounts.passkey + methodCounts.deviceApproval) / totalMethodEvents) * 100)
    : 0;

  const httpsRedirects = redirectUris.filter((uri) => uri.startsWith("https://")).length;

  return {
    totalIdentities: authorizationGroups.reduce((total, entry) => total + Number(entry.identityCount || 0), 0),
    totalAuthorizations: authorizationGroups.reduce((total, entry) => total + Number(entry.authorizationCount || 0), 0),
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
  const refreshCount = sql<number>`count(${oauthRefreshTokens.id})`;
  const lastRefreshAt = sql<number | null>`max(${oauthRefreshTokens.createdAt})`;
  const lastActiveAt = sql<number>`max(
    coalesce(${oauthRefreshTokens.createdAt}, 0),
    ${oauthAuthorizations.lastAuthorizedAt}
  )`;

  const [totalRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthAuthorizations)
      .where(eq(oauthAuthorizations.appId, appId)),
    db
      .select({
        id: identities.id,
        displayName: identities.displayName,
        handle: identities.handle,
        email: identities.email,
        avatarUrl: identities.avatarUrl,
        isPrimary: identities.isPrimary,
        identityCreatedAt: identities.createdAt,
        firstSeen: oauthAuthorizations.createdAt,
        lastAuthorizedAt: oauthAuthorizations.lastAuthorizedAt,
        authorizationCount: oauthAuthorizations.authorizationCount,
        lastMethod: oauthAuthorizations.lastAuthMethod,
        refreshCount,
        lastRefreshAt,
      })
      .from(oauthAuthorizations)
      .innerJoin(identities, eq(identities.id, oauthAuthorizations.identityId))
      .leftJoin(
        oauthRefreshTokens,
        and(
          eq(oauthRefreshTokens.appId, oauthAuthorizations.appId),
          eq(oauthRefreshTokens.identityId, oauthAuthorizations.identityId),
        ),
      )
      .where(eq(oauthAuthorizations.appId, appId))
      .groupBy(oauthAuthorizations.id, identities.id)
      .orderBy(desc(lastActiveAt), desc(oauthAuthorizations.id))
      .limit(limit)
      .offset(offset),
  ]);

  const total = totalRow[0]?.count || 0;
  const items = rows.map((row) => {
    const lastRefresh = row.lastRefreshAt ? new Date(row.lastRefreshAt) : null;
    return {
      id: row.id,
      displayName: row.displayName,
      handle: row.handle,
      email: row.email,
      avatarUrl: row.avatarUrl,
      isPrimary: row.isPrimary,
      firstSeen: row.firstSeen || row.identityCreatedAt,
      lastActive: lastRefresh || row.lastAuthorizedAt || row.identityCreatedAt,
      signInCount: row.authorizationCount + row.refreshCount,
      authorizationCount: row.authorizationCount,
      refreshCount: row.refreshCount,
      lastMethod: row.lastMethod,
    };
  });

  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

async function getAppActivity(appId: string, limit = 25, offset = 0) {
  const d1 = (db as unknown as { $client?: D1Database }).$client;
  if (!d1) {
    throw new Error("D1 client unavailable for activity query");
  }

  const [activityResult, analyticsCount, delegationCount] = await Promise.all([
    d1
      .prepare(
        `SELECT id, action, details, severity, createdAt, source FROM (
          SELECT id, event_type AS action, metadata AS details, severity, created_at AS createdAt, 'activity' AS source
          FROM app_analytics_events
          WHERE app_id = ?
          UNION ALL
          SELECT id, event_type AS action, details, 'info' AS severity, created_at AS createdAt, 'delegation' AS source
          FROM oauth_delegation_audit_logs
          WHERE source_app_id = ?
        )
        ORDER BY createdAt DESC
        LIMIT ? OFFSET ?`,
      )
      .bind(appId, appId, limit, offset)
      .all<AppActivityRow>(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(appAnalyticsEvents)
      .where(eq(appAnalyticsEvents.appId, appId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(oauthDelegationAuditLogs)
      .where(eq(oauthDelegationAuditLogs.sourceAppId, appId)),
  ]);

  const items = (activityResult.results || []).map((row) => ({
    id: row.id,
    action: row.action,
    details: parseActivityDetails(row.details),
    severity: row.severity,
    createdAt: new Date(row.createdAt),
    source: row.source,
  }));

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
  const authorizationCounts = apps.length
    ? await db
        .select({
          appId: oauthAuthorizations.appId,
          identityCount: sql<number>`count(distinct ${oauthAuthorizations.identityId})`,
        })
        .from(oauthAuthorizations)
        .where(inArray(oauthAuthorizations.appId, apps.map((appRow) => appRow.id)))
        .groupBy(oauthAuthorizations.appId)
    : [];

  const resourcesByAppId = new Map<string, typeof resources>();
  for (const resource of resources) {
    const list = resourcesByAppId.get(resource.ownerAppId) || [];
    list.push(resource);
    resourcesByAppId.set(resource.ownerAppId, list);
  }

  const identityCountByAppId = new Map<string, number>();
  for (const authorizationCount of authorizationCounts) {
    identityCountByAppId.set(authorizationCount.appId, Number(authorizationCount.identityCount || 0));
  }

  return c.json({
    apps: apps.map((appRow) =>
      serializeApp(
        appRow,
        resourcesByAppId.get(appRow.id) || [],
        identityCountByAppId.get(appRow.id) || 0,
      ),
    ),
  });
});

app.post("/", requireWritableDevUser, zValidator("json", baseAppSchema), async (c) => {
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
      developmentMode: data.developmentMode,
      supportsE2ee: syncSupportsE2eeFlag(data.supportsE2ee),
      allowedScopes: stripE2eeScopes(data.allowedScopes),
      accessTokenTtlSeconds: data.accessTokenTtlSeconds || 3600,
      refreshTokenTtlSeconds: data.refreshTokenTtlSeconds || 30 * 24 * 60 * 60,
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

app.patch("/:appId", requireWritableDevUser, zValidator("json", baseAppSchema.partial()), async (c) => {
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

  const nextAllowedScopes = stripE2eeScopes(
    data.allowedScopes ?? (accessible.app.allowedScopes as string[]),
  );
  const nextSupportsE2ee = syncSupportsE2eeFlag(
    !!(data.supportsE2ee ?? accessible.app.supportsE2ee),
  );

  const [updated] = await db
    .update(oauthApps)
    .set({
      name: data.name ?? accessible.app.name,
      description: data.description === undefined ? accessible.app.description : data.description,
      websiteUrl: data.websiteUrl === undefined ? accessible.app.websiteUrl : data.websiteUrl,
      iconUrl: data.iconUrl === undefined ? accessible.app.iconUrl : data.iconUrl,
      redirectUris: data.redirectUris ?? (accessible.app.redirectUris as string[]),
      developmentMode: data.developmentMode ?? accessible.app.developmentMode,
      supportsE2ee: nextSupportsE2ee,
      allowedScopes: nextAllowedScopes,
      accessTokenTtlSeconds: data.accessTokenTtlSeconds ?? accessible.app.accessTokenTtlSeconds,
      refreshTokenTtlSeconds: data.refreshTokenTtlSeconds ?? accessible.app.refreshTokenTtlSeconds,
      organizationId: nextOrganizationId,
    })
    .where(eq(oauthApps.id, appId))
    .returning();

  const resources = await listAppResources([updated.id]);
  return c.json({ app: serializeApp(updated, resources) });
});

app.delete("/:appId", requireWritableDevUser, async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");

  const accessible = await getAccessibleApp(userId, appId, "admin");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }

  await db.delete(oauthApps).where(eq(oauthApps.id, appId));
  return c.json({ success: true });
});

app.post("/:appId/rotate-secret", requireWritableDevUser, async (c) => {
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

app.post("/:appId/resources", requireWritableDevUser, zValidator("json", resourceSchema), async (c) => {
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

app.patch("/:appId/resources/:resourceId", requireWritableDevUser, zValidator("json", resourceSchema.partial()), async (c) => {
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

app.delete("/:appId/resources/:resourceId", requireWritableDevUser, async (c) => {
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
