import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, oauthApps } from "../db";
import { eq, and } from "drizzle-orm";
import { generateRandomId, hashSessionToken } from "../lib/crypto";
import { verifyJwt, getResourceAudience } from "../lib/oidc";

const app = new Hono();

const DEV_PORTAL_CLIENT_ID = process.env.DEV_PORTAL_CLIENT_ID;
const RESOURCE_AUDIENCE = getResourceAudience();
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

async function requireOidcUser(c: any, next: any) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, RESOURCE_AUDIENCE);
  if (!payload) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!DEV_PORTAL_CLIENT_ID) {
    return c.json({ error: "DEV_PORTAL_CLIENT_ID not configured" }, 500);
  }

  if (payload.cid !== DEV_PORTAL_CLIENT_ID) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const scope = typeof payload.scope === "string" ? payload.scope : "";
  if (!scope.split(" ").includes("user_id")) {
    return c.json({ error: "Insufficient scope" }, 403);
  }

  const userId = (payload.uid || payload.sid) as string | undefined;
  if (!userId) {
    return c.json({ error: "User ID unavailable" }, 403);
  }

  c.set("devUserId", userId);
  return next();
}

app.use("*", requireOidcUser);

app.get("/", async (c) => {
  const userId = c.get("devUserId") as string;
  const apps = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.ownerId, userId));

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

export default app;
