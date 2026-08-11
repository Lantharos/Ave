import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  oauthApps,
  oauthAuthorizations,
  oauthResources,
} from "../db";
import { generateRandomId, hashSessionToken } from "../lib/crypto";
import {
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
import {
  activityPaginationQuerySchema,
  decodeActivityCursor,
  getAppActivity,
  getAppIdentities,
  getAppInsights,
  paginationQuerySchema,
} from "./apps/app-data";
import { requireDevUser, requireWritableDevUser } from "./apps/auth";

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

export async function listAppResources(appIds: string[]) {
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

app.get("/:appId/activity", zValidator("query", activityPaginationQuerySchema), async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");
  const { limit = 25, cursor: encodedCursor } = c.req.valid("query");
  const cursor = decodeActivityCursor(encodedCursor);

  if (encodedCursor && !cursor) {
    return c.json({ error: "Invalid activity cursor" }, 400);
  }

  const accessible = await getAccessibleApp(userId, appId, "viewer");
  if (!accessible) {
    return c.json({ error: "App not found" }, 404);
  }
  return c.json(await getAppActivity(appId, limit, cursor || undefined));
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
    getAppActivity(appId, 8),
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
