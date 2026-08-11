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
      authorizations: [],
    });
  }

  const [appAuthorizationRows, resources] = await db.batch([
    db
      .select({
        oauthApp: {
          id: oauthApps.id,
          name: oauthApps.name,
          description: oauthApps.description,
          iconUrl: oauthApps.iconUrl,
          websiteUrl: oauthApps.websiteUrl,
          supportsE2ee: oauthApps.supportsE2ee,
          allowedScopes: oauthApps.allowedScopes,
        },
        authorization: oauthAuthorizations,
      })
      .from(oauthApps)
      .leftJoin(oauthAuthorizations, and(
        eq(oauthAuthorizations.userId, user.id),
        eq(oauthAuthorizations.appId, oauthApps.id),
        identityId ? eq(oauthAuthorizations.identityId, identityId) : undefined,
      ))
      .where(eq(oauthApps.clientId, clientId))
      .orderBy(desc(oauthAuthorizations.lastAuthorizedAt)),
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
      .innerJoin(oauthApps, eq(oauthApps.id, oauthResources.ownerAppId))
      .where(and(
        eq(oauthApps.clientId, clientId),
        eq(oauthResources.status, "active"),
      )),
  ]);
  const oauthApp = appAuthorizationRows[0]?.oauthApp;

  if (!oauthApp) {
    return c.json({ error: "App not found" }, 404);
  }

  return c.json({
    app: {
      ...oauthApp,
      supportsE2ee: appEffectiveSupportsE2ee(oauthApp),
    },
    resources,
    authorizations: appAuthorizationRows.flatMap(({ authorization }) => authorization
      ? [{
        id: authorization.id,
        identityId: authorization.identityId,
        encryptedAppKey: authorization.encryptedAppKey,
        appPublicKey: authorization.appPublicKey,
        encryptedAppPrivateKey: authorization.encryptedAppPrivateKey,
        appEncryptionMode: authorization.appEncryptionMode,
        createdAt: authorization.createdAt,
      }]
      : []),
  });
});

export default app;
