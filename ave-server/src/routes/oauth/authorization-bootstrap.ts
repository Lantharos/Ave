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
        appId: oauthApps.id,
        appName: oauthApps.name,
        appDescription: oauthApps.description,
        appIconUrl: oauthApps.iconUrl,
        appWebsiteUrl: oauthApps.websiteUrl,
        appSupportsE2ee: oauthApps.supportsE2ee,
        appAllowedScopes: oauthApps.allowedScopes,
        authorizationId: oauthAuthorizations.id,
        authorizationIdentityId: oauthAuthorizations.identityId,
        authorizationEncryptedAppKey: oauthAuthorizations.encryptedAppKey,
        authorizationAppPublicKey: oauthAuthorizations.appPublicKey,
        authorizationEncryptedAppPrivateKey: oauthAuthorizations.encryptedAppPrivateKey,
        authorizationAppEncryptionMode: oauthAuthorizations.appEncryptionMode,
        authorizationCreatedAt: oauthAuthorizations.createdAt,
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
  const appRow = appAuthorizationRows[0];

  if (!appRow) {
    return c.json({ error: "App not found" }, 404);
  }

  const oauthApp = {
    id: appRow.appId,
    name: appRow.appName,
    description: appRow.appDescription,
    iconUrl: appRow.appIconUrl,
    websiteUrl: appRow.appWebsiteUrl,
    supportsE2ee: appRow.appSupportsE2ee,
    allowedScopes: appRow.appAllowedScopes,
  };
  const authorizations = appAuthorizationRows.flatMap((row) => row.authorizationId
    ? [{
      id: row.authorizationId,
      identityId: row.authorizationIdentityId,
      encryptedAppKey: row.authorizationEncryptedAppKey,
      appPublicKey: row.authorizationAppPublicKey,
      encryptedAppPrivateKey: row.authorizationEncryptedAppPrivateKey,
      appEncryptionMode: row.authorizationAppEncryptionMode,
      createdAt: row.authorizationCreatedAt,
    }]
    : []);

  const invalidAuthorization = authorizations.some((authorization) =>
    typeof authorization.id !== "string" ||
    typeof authorization.identityId !== "string" ||
    !(authorization.createdAt instanceof Date) ||
    (authorization.encryptedAppKey !== null && typeof authorization.encryptedAppKey !== "string") ||
    (authorization.appPublicKey !== null && typeof authorization.appPublicKey !== "string") ||
    (authorization.encryptedAppPrivateKey !== null && typeof authorization.encryptedAppPrivateKey !== "string") ||
    (authorization.appEncryptionMode !== null && typeof authorization.appEncryptionMode !== "string")
  );
  if (invalidAuthorization) {
    return c.json({ error: "Invalid authorization data" }, 500);
  }

  c.header("Cache-Control", "no-store");

  return c.json({
    app: {
      ...oauthApp,
      supportsE2ee: appEffectiveSupportsE2ee(oauthApp),
    },
    resources,
    authorizations,
  });
});

export default app;
