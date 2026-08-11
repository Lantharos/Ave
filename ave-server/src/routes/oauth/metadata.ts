import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db, oauthApps, oauthResources } from "../../db";
import { getQuickOrigin, isQuickClient } from "./shared";

const app = new Hono();

app.get("/app/:clientId", async (c) => {
  const clientId = c.req.param("clientId");
  c.header("Cache-Control", "public, max-age=60, s-maxage=300");

  if (isQuickClient(clientId)) {
    const quickOrigin = getQuickOrigin(clientId);
    if (!quickOrigin) {
      return c.json({ error: "App not found" }, 404);
    }
    return c.json({
      app: {
        id: clientId,
        name: quickOrigin,
        description: "Quick Ave — authenticate without app registration",
        iconUrl: null,
        websiteUrl: quickOrigin,
        supportsE2ee: false,
      },
      resources: [],
    });
  }

  const [oauthApp] = await db
    .select({
      id: oauthApps.id,
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

  const resources = await db
    .select({
      resourceKey: oauthResources.resourceKey,
      displayName: oauthResources.displayName,
      description: oauthResources.description,
      scopes: oauthResources.scopes,
      audience: oauthResources.audience,
      status: oauthResources.status,
    })
    .from(oauthResources)
    .where(and(eq(oauthResources.ownerAppId, (oauthApp as any).id), eq(oauthResources.status, "active")));

  return c.json({ app: oauthApp, resources });
});

// Public: Get connector resource info by resource key (for connector UX)
app.get("/resource/:resourceKey", async (c) => {
  const resourceKey = c.req.param("resourceKey");
  c.header("Cache-Control", "public, max-age=60, s-maxage=300");

  const [resource] = await db
    .select({
      resourceKey: oauthResources.resourceKey,
      displayName: oauthResources.displayName,
      description: oauthResources.description,
      scopes: oauthResources.scopes,
      audience: oauthResources.audience,
      status: oauthResources.status,
      ownerAppClientId: oauthApps.clientId,
      ownerAppName: oauthApps.name,
      ownerAppDescription: oauthApps.description,
      ownerAppIconUrl: oauthApps.iconUrl,
      ownerAppWebsiteUrl: oauthApps.websiteUrl,
    })
    .from(oauthResources)
    .innerJoin(oauthApps, eq(oauthResources.ownerAppId, oauthApps.id))
    .where(and(eq(oauthResources.resourceKey, resourceKey), eq(oauthResources.status, "active")))
    .limit(1);

  if (!resource) {
    return c.json({ error: "Resource not found" }, 404);
  }

  return c.json({ resource });
});

export default app;
