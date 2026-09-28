import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, oauthApps } from "../../db";

const app = new Hono();

app.get("/app/:clientId", async (c) => {
  const clientId = c.req.param("clientId");
  c.header("Cache-Control", "public, max-age=60, s-maxage=300");

  const [oauthApp] = await db
    .select({
      id: oauthApps.id,
      name: oauthApps.name,
      description: oauthApps.description,
      iconUrl: oauthApps.iconUrl,
      websiteUrl: oauthApps.websiteUrl,
    })
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);

  if (!oauthApp) {
    return c.json({ error: "App not found" }, 404);
  }

  return c.json({ app: oauthApp });
});

export default app;
