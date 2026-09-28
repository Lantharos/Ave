import { zValidator } from "@hono/zod-validator";
import { eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db, oauthApps, oauthAuthorizations } from "../db";
import { generateRandomId, hashSessionToken } from "../lib/identity/crypto";
import {
  ensurePersonalOrganization,
  getAccessibleApp,
  getAccessibleApps,
  requireOrganizationAccess,
} from "../lib/developer/dev-portal";
import {
  PORTAL_APP_SCOPES,
  stripE2eeScopes,
} from "../lib/identity/e2ee-scopes";
import { getAppIdentities, paginationQuerySchema } from "./apps/app-identities";
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
  allowedScopes: z.array(z.enum(allowedScopes)).default(["openid", "profile", "email", "offline_access"]),
  accessTokenTtlSeconds: z.number().int().min(300).max(86400).optional(),
  refreshTokenTtlSeconds: z.number().int().min(3600).max(60 * 60 * 24 * 365).optional(),
  organizationId: z.string().min(1).optional(),
});

export function serializeApp(
  appRow: typeof oauthApps.$inferSelect,
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
    allowedScopes: stripE2eeScopes(appRow.allowedScopes as string[]),
    accessTokenTtlSeconds: appRow.accessTokenTtlSeconds,
    refreshTokenTtlSeconds: appRow.refreshTokenTtlSeconds,
    createdAt: appRow.createdAt,
    organizationId: appRow.organizationId,
    identityCount,
  };
}

app.use("*", requireDevUser);

app.get("/", async (c) => {
  const user = c.get("devUser");
  const requestedOrganizationId = c.req.query("organizationId");
  const apps = await getAccessibleApps(user, requestedOrganizationId);
  const authorizationCounts = apps.length
    ? await db
        .select({
          appId: oauthAuthorizations.appId,
          identityCount: sql<number>`count(*)`,
        })
        .from(oauthAuthorizations)
        .where(inArray(oauthAuthorizations.appId, apps.map((appRow) => appRow.id)))
        .groupBy(oauthAuthorizations.appId)
    : [];

  const identityCountByAppId = new Map<string, number>();
  for (const authorizationCount of authorizationCounts) {
    identityCountByAppId.set(authorizationCount.appId, Number(authorizationCount.identityCount || 0));
  }

  return c.json({
    apps: apps.map((appRow) =>
      serializeApp(appRow, identityCountByAppId.get(appRow.id) || 0),
    ),
  });
});

app.post("/", requireWritableDevUser, zValidator("json", baseAppSchema), async (c) => {
  const user = c.get("devUser");
  const data = c.req.valid("json");
  const personalOrganization = await ensurePersonalOrganization(user.id);
  const organizationId = data.organizationId || personalOrganization.id;

  const membership = await requireOrganizationAccess(user, organizationId);
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
      allowedScopes: stripE2eeScopes(data.allowedScopes),
      accessTokenTtlSeconds: data.accessTokenTtlSeconds || 3600,
      refreshTokenTtlSeconds: data.refreshTokenTtlSeconds || 30 * 24 * 60 * 60,
      clientId,
      clientSecretHash,
      organizationId,
    })
    .returning();

  return c.json({
    app: serializeApp(newApp),
    clientSecret,
  });
});

app.get("/:appId/identities", zValidator("query", paginationQuerySchema), async (c) => {
  const user = c.get("devUser");
  const appId = c.req.param("appId");
  const { limit = 25, offset = 0 } = c.req.valid("query");

  const accessibleApp = await getAccessibleApp(user, appId);
  if (!accessibleApp) {
    return c.json({ error: "App not found" }, 404);
  }
  return c.json(await getAppIdentities(appId, limit, offset));
});

app.patch("/:appId", requireWritableDevUser, zValidator("json", baseAppSchema.partial()), async (c) => {
  const user = c.get("devUser");
  const appId = c.req.param("appId");
  const data = c.req.valid("json");

  const accessibleApp = await getAccessibleApp(user, appId);
  if (!accessibleApp) {
    return c.json({ error: "App not found" }, 404);
  }

  let nextOrganizationId = accessibleApp.organizationId;
  if (data.organizationId && data.organizationId !== accessibleApp.organizationId) {
    const destination = await requireOrganizationAccess(user, data.organizationId);
    if (!destination) {
      return c.json({ error: "Organization not found" }, 404);
    }
    nextOrganizationId = data.organizationId;
  }

  const nextAllowedScopes = stripE2eeScopes(
    data.allowedScopes ?? (accessibleApp.allowedScopes as string[]),
  );

  const [updated] = await db
    .update(oauthApps)
    .set({
      name: data.name ?? accessibleApp.name,
      description: data.description === undefined ? accessibleApp.description : data.description,
      websiteUrl: data.websiteUrl === undefined ? accessibleApp.websiteUrl : data.websiteUrl,
      iconUrl: data.iconUrl === undefined ? accessibleApp.iconUrl : data.iconUrl,
      redirectUris: data.redirectUris ?? (accessibleApp.redirectUris as string[]),
      developmentMode: data.developmentMode ?? accessibleApp.developmentMode,
      allowedScopes: nextAllowedScopes,
      accessTokenTtlSeconds: data.accessTokenTtlSeconds ?? accessibleApp.accessTokenTtlSeconds,
      refreshTokenTtlSeconds: data.refreshTokenTtlSeconds ?? accessibleApp.refreshTokenTtlSeconds,
      organizationId: nextOrganizationId,
    })
    .where(eq(oauthApps.id, appId))
    .returning();

  return c.json({ app: serializeApp(updated) });
});

app.delete("/:appId", requireWritableDevUser, async (c) => {
  const user = c.get("devUser");
  const appId = c.req.param("appId");

  const accessibleApp = await getAccessibleApp(user, appId);
  if (!accessibleApp) {
    return c.json({ error: "App not found" }, 404);
  }

  await db.delete(oauthApps).where(eq(oauthApps.id, appId));
  return c.json({ success: true });
});

app.post("/:appId/rotate-secret", requireWritableDevUser, async (c) => {
  const user = c.get("devUser");
  const appId = c.req.param("appId");

  const accessibleApp = await getAccessibleApp(user, appId);
  if (!accessibleApp) {
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
