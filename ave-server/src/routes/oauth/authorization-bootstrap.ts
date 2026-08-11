import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db, oauthApps, oauthAuthorizations, oauthResources } from "../../db";
import { appEffectiveSupportsE2ee } from "../../lib/e2ee-scopes";
import { requireAuth } from "../../middleware/auth";
import { getQuickOrigin, isQuickClient } from "./shared";

const app = new Hono();

function serializeTimestamp(value: unknown): string | null {
  const date = value instanceof Date
    ? value
    : typeof value === "number"
      ? new Date(value)
      : typeof value === "string"
        ? new Date(/^\d+$/.test(value) ? Number(value) : value)
        : null;

  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

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

  const appAuthorizationsQuery = db
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
    .orderBy(desc(oauthAuthorizations.lastAuthorizedAt));
  const resourcesQuery = db
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
    ));
  const [appAuthorizationRows, resources] = await Promise.all([
    appAuthorizationsQuery,
    resourcesQuery,
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
  const authorizations = appAuthorizationRows.flatMap((row) => {
    if (!row.authorizationId) return [];

    const createdAt = serializeTimestamp(row.authorizationCreatedAt);
    return [{
      id: row.authorizationId,
      identityId: row.authorizationIdentityId,
      encryptedAppKey: row.authorizationEncryptedAppKey,
      appPublicKey: row.authorizationAppPublicKey,
      encryptedAppPrivateKey: row.authorizationEncryptedAppPrivateKey,
      appEncryptionMode: row.authorizationAppEncryptionMode,
      createdAt,
    }];
  });

  const invalidFields = new Set<string>();
  for (const authorization of authorizations) {
    if (typeof authorization.id !== "string") invalidFields.add("id");
    if (typeof authorization.identityId !== "string") invalidFields.add("identityId");
    if (authorization.createdAt === null) invalidFields.add("createdAt");
    if (authorization.encryptedAppKey !== null && typeof authorization.encryptedAppKey !== "string") {
      invalidFields.add("encryptedAppKey");
    }
    if (authorization.appPublicKey !== null && typeof authorization.appPublicKey !== "string") {
      invalidFields.add("appPublicKey");
    }
    if (
      authorization.encryptedAppPrivateKey !== null &&
      typeof authorization.encryptedAppPrivateKey !== "string"
    ) {
      invalidFields.add("encryptedAppPrivateKey");
    }
    if (authorization.appEncryptionMode !== null && typeof authorization.appEncryptionMode !== "string") {
      invalidFields.add("appEncryptionMode");
    }
  }
  if (invalidFields.size > 0) {
    const fields = [...invalidFields];
    console.error("Invalid OAuth authorization bootstrap fields", {
      clientId,
      fields,
      authorizationCount: authorizations.length,
    });
    return c.json({ error: "Invalid authorization data", invalidFields: fields }, 500);
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
