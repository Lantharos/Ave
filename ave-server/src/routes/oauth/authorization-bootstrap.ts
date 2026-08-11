import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db, oauthApps, oauthAuthorizations, oauthResources } from "../../db";
import { appEffectiveSupportsE2ee } from "../../lib/e2ee-scopes";
import { requireAuth } from "../../middleware/auth";
import { getQuickOrigin, isQuickClient } from "./shared";

const app = new Hono();

app.get("/authorize/bootstrap/:clientId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const clientId = c.req.param("clientId") || "";
  const identityId = c.req.query("identity_id");

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
      authorization: null,
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
      allowedScopes: oauthApps.allowedScopes,
    })
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);

  if (!oauthApp) {
    return c.json({ error: "App not found" }, 404);
  }

  const [resources, authorization] = await Promise.all([
    db
      .select({
        resourceKey: oauthResources.resourceKey,
        displayName: oauthResources.displayName,
        description: oauthResources.description,
        scopes: oauthResources.scopes,
        audience: oauthResources.audience,
        status: oauthResources.status,
      })
      .from(oauthResources)
      .where(and(eq(oauthResources.ownerAppId, oauthApp.id), eq(oauthResources.status, "active"))),
    db
      .select()
      .from(oauthAuthorizations)
      .where(
        identityId
          ? and(
              eq(oauthAuthorizations.userId, user.id),
              eq(oauthAuthorizations.appId, oauthApp.id),
              eq(oauthAuthorizations.identityId, identityId),
            )
          : and(
              eq(oauthAuthorizations.userId, user.id),
              eq(oauthAuthorizations.appId, oauthApp.id),
            ),
      )
      .orderBy(desc(oauthAuthorizations.lastAuthorizedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  return c.json({
    app: {
      ...oauthApp,
      supportsE2ee: appEffectiveSupportsE2ee(oauthApp),
    },
    resources,
    authorization: authorization
      ? {
          id: authorization.id,
          identityId: authorization.identityId,
          encryptedAppKey: authorization.encryptedAppKey,
          appPublicKey: authorization.appPublicKey,
          encryptedAppPrivateKey: authorization.encryptedAppPrivateKey,
          appEncryptionMode: authorization.appEncryptionMode,
          createdAt: authorization.createdAt,
        }
      : null,
  });
});

export default app;
