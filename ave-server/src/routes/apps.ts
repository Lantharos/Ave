import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, oauthApps, oauthResources } from "../db";
import { eq, and, inArray } from "drizzle-orm";
import { generateRandomId, hashSessionToken } from "../lib/crypto";
import { verifyJwt, getResourceAudience } from "../lib/oidc";

declare module "hono" {
  interface ContextVariableMap {
    devUserId: string;
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
});

const resourceSchema = z.object({
  resourceKey: z.string().min(3).max(100).regex(/^[a-z0-9:_-]+$/),
  displayName: z.string().min(2).max(80),
  description: z.string().max(240).optional(),
  scopes: z.array(z.string().min(2).max(80)).min(1),
  audience: z.string().min(3).max(200),
  status: z.enum(["active", "disabled"]).optional(),
});

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
          return next();
        }
      }
    } catch {}
  }

  const sessionUser = c.get("user");
  if (sessionUser?.id) {
    c.set("devUserId", sessionUser.id);
    return next();
  }

  return c.json({ error: "Unauthorized" }, 401);
}

app.use("*", requireDevUser);

app.get("/", async (c) => {
  const userId = c.get("devUserId") as string;
  const apps = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.ownerId, userId));

  const appIds = apps.map((appItem) => appItem.id);
  const resources = appIds.length === 0
    ? []
    : await db
      .select()
      .from(oauthResources)
      .where(inArray(oauthResources.ownerAppId, appIds));

  const resourcesByAppId = new Map<string, typeof resources>();
  for (const resource of resources) {
    const list = resourcesByAppId.get(resource.ownerAppId) || [];
    list.push(resource);
    resourcesByAppId.set(resource.ownerAppId, list);
  }

  return c.json({
    apps: apps.map((appItem) => ({
      id: appItem.id,
      clientId: appItem.clientId,
      name: appItem.name,
      description: appItem.description,
      websiteUrl: appItem.websiteUrl,
      iconUrl: appItem.iconUrl,
      redirectUris: appItem.redirectUris as string[],
      supportsE2ee: !!appItem.supportsE2ee,
      allowedScopes: appItem.allowedScopes as string[],
      accessTokenTtlSeconds: appItem.accessTokenTtlSeconds,
      refreshTokenTtlSeconds: appItem.refreshTokenTtlSeconds,
      allowUserIdScope: !!appItem.allowUserIdScope,
      createdAt: appItem.createdAt,
      resources: (resourcesByAppId.get(appItem.id) || []).map((resource) => ({
        id: resource.id,
        resourceKey: resource.resourceKey,
        displayName: resource.displayName,
        description: resource.description,
        scopes: resource.scopes as string[],
        audience: resource.audience,
        status: resource.status,
      })),
    })),
  });
});

app.post("/", zValidator("json", baseAppSchema), async (c) => {
  const userId = c.get("devUserId") as string;
  const data = c.req.valid("json");

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
    })
    .returning();

  return c.json({
    app: {
      id: newApp.id,
      clientId: newApp.clientId,
      name: newApp.name,
      description: newApp.description,
      websiteUrl: newApp.websiteUrl,
      iconUrl: newApp.iconUrl,
      redirectUris: newApp.redirectUris as string[],
      supportsE2ee: !!newApp.supportsE2ee,
      allowedScopes: newApp.allowedScopes as string[],
      accessTokenTtlSeconds: newApp.accessTokenTtlSeconds,
      refreshTokenTtlSeconds: newApp.refreshTokenTtlSeconds,
      allowUserIdScope: !!newApp.allowUserIdScope,
      createdAt: newApp.createdAt,
    },
    clientSecret,
  });
});

app.patch("/:appId", zValidator("json", baseAppSchema.partial()), async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");
  const data = c.req.valid("json");

  const [existing] = await db
    .select()
    .from(oauthApps)
    .where(and(eq(oauthApps.id, appId), eq(oauthApps.ownerId, userId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "App not found" }, 404);
  }

  const [updated] = await db
    .update(oauthApps)
    .set({
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      websiteUrl: data.websiteUrl ?? existing.websiteUrl,
      iconUrl: data.iconUrl ?? existing.iconUrl,
      redirectUris: data.redirectUris ?? (existing.redirectUris as string[]),
      supportsE2ee: data.supportsE2ee ?? existing.supportsE2ee,
      allowedScopes: data.allowedScopes ?? (existing.allowedScopes as string[]),
      accessTokenTtlSeconds: data.accessTokenTtlSeconds ?? existing.accessTokenTtlSeconds,
      refreshTokenTtlSeconds: data.refreshTokenTtlSeconds ?? existing.refreshTokenTtlSeconds,
      allowUserIdScope: data.allowUserIdScope ?? existing.allowUserIdScope,
    })
    .where(eq(oauthApps.id, appId))
    .returning();

  return c.json({
    app: {
      id: updated.id,
      clientId: updated.clientId,
      name: updated.name,
      description: updated.description,
      websiteUrl: updated.websiteUrl,
      iconUrl: updated.iconUrl,
      redirectUris: updated.redirectUris as string[],
      supportsE2ee: !!updated.supportsE2ee,
      allowedScopes: updated.allowedScopes as string[],
      accessTokenTtlSeconds: updated.accessTokenTtlSeconds,
      refreshTokenTtlSeconds: updated.refreshTokenTtlSeconds,
      allowUserIdScope: !!updated.allowUserIdScope,
      createdAt: updated.createdAt,
    },
  });
});

app.delete("/:appId", async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");

  const [existing] = await db
    .select()
    .from(oauthApps)
    .where(and(eq(oauthApps.id, appId), eq(oauthApps.ownerId, userId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "App not found" }, 404);
  }

  await db.delete(oauthApps).where(eq(oauthApps.id, appId));

  return c.json({ success: true });
});

app.post("/:appId/rotate-secret", async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");

  const [existing] = await db
    .select()
    .from(oauthApps)
    .where(and(eq(oauthApps.id, appId), eq(oauthApps.ownerId, userId)))
    .limit(1);

  if (!existing) {
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

  const [existing] = await db
    .select()
    .from(oauthApps)
    .where(and(eq(oauthApps.id, appId), eq(oauthApps.ownerId, userId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "App not found" }, 404);
  }

  const resources = await db
    .select()
    .from(oauthResources)
    .where(eq(oauthResources.ownerAppId, appId));

  return c.json({ resources });
});

app.post("/:appId/resources", zValidator("json", resourceSchema), async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");
  const data = c.req.valid("json");

  const [existing] = await db
    .select()
    .from(oauthApps)
    .where(and(eq(oauthApps.id, appId), eq(oauthApps.ownerId, userId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "App not found" }, 404);
  }

  const [created] = await db
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

  return c.json({ resource: created });
});

app.patch("/:appId/resources/:resourceId", zValidator("json", resourceSchema.partial()), async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");
  const resourceId = c.req.param("resourceId");
  const data = c.req.valid("json");

  const [existing] = await db
    .select()
    .from(oauthApps)
    .where(and(eq(oauthApps.id, appId), eq(oauthApps.ownerId, userId)))
    .limit(1);

  if (!existing) {
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

  const [updated] = await db
    .update(oauthResources)
    .set({
      resourceKey: data.resourceKey ?? resource.resourceKey,
      displayName: data.displayName ?? resource.displayName,
      description: data.description ?? resource.description,
      scopes: data.scopes ?? (resource.scopes as string[]),
      audience: data.audience ?? resource.audience,
      status: data.status ?? resource.status,
      updatedAt: new Date(),
    })
    .where(eq(oauthResources.id, resourceId))
    .returning();

  return c.json({ resource: updated });
});

app.delete("/:appId/resources/:resourceId", async (c) => {
  const userId = c.get("devUserId") as string;
  const appId = c.req.param("appId");
  const resourceId = c.req.param("resourceId");

  const [existing] = await db
    .select()
    .from(oauthApps)
    .where(and(eq(oauthApps.id, appId), eq(oauthApps.ownerId, userId)))
    .limit(1);

  if (!existing) {
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
