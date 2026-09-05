import { and, eq, isNull } from "drizzle-orm";
import type { Context } from "hono";
import { db, oauthApps, oauthDelegationGrants, oauthResources, primaryDb } from "../../db";
import { recordOAuthDelegationAuditLog } from "../../lib/background-events";
import { getIssuer, signJwt } from "../../lib/oidc";
import { hasAllScopes, isClientSecretValid, nowSeconds, parseScopes, resolveAccessTokenRecord } from "./shared";
import type { TokenExchangeRequest } from "./token-schema";

export async function handleTokenExchange(c: Context, payload: TokenExchangeRequest) {
  const { subjectToken, requestedResource, requestedScope, clientId, clientSecret, actor } = payload;

  const [sourceApp] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);

  if (!sourceApp) {
    return c.json({ error: "invalid_client", error_description: "Client not found" }, 400);
  }

  if (!clientSecret || !isClientSecretValid(sourceApp.clientSecretHash, clientSecret)) {
    return c.json({ error: "invalid_client", error_description: "Invalid client secret" }, 400);
  }

  const subject = await resolveAccessTokenRecord(subjectToken);

  if (!subject?.userId) {
    return c.json({ error: "invalid_grant", error_description: "Subject token is invalid" }, 400);
  }

  if (subject.appId !== sourceApp.id) {
    return c.json({ error: "invalid_grant", error_description: "Subject token does not belong to client" }, 400);
  }

  const [resourceContext] = await primaryDb
    .select({ resource: oauthResources, grant: oauthDelegationGrants })
    .from(oauthResources)
    .leftJoin(oauthDelegationGrants, and(
      eq(oauthDelegationGrants.authorizationId, subject.authorizationId || ""),
      eq(oauthDelegationGrants.userId, subject.userId),
      eq(oauthDelegationGrants.identityId, subject.identityId),
      eq(oauthDelegationGrants.sourceAppId, sourceApp.id),
      eq(oauthDelegationGrants.targetResourceId, oauthResources.id),
      isNull(oauthDelegationGrants.revokedAt),
    ))
    .where(and(eq(oauthResources.resourceKey, requestedResource), eq(oauthResources.status, "active")))
    .limit(1);
  const resource = resourceContext?.resource;
  const grant = resourceContext?.grant;

  if (!resource) {
    return c.json({ error: "invalid_target", error_description: "Requested resource not found" }, 400);
  }

  const requestedConnectorScopes = parseScopes(requestedScope);
  const invalidScopes = requestedConnectorScopes.filter((scope) => !((resource.scopes || []) as string[]).includes(scope));
  if (invalidScopes.length > 0) {
    return c.json({ error: "invalid_scope", error_description: `Invalid connector scopes: ${invalidScopes.join(", ")}` }, 400);
  }

  if (!grant) {
    return c.json({ error: "access_denied", error_description: "No active connector grant found" }, 403);
  }

  if (!hasAllScopes(grant.scope, requestedScope)) {
    return c.json({ error: "invalid_scope", error_description: "Requested scope exceeds granted scope" }, 400);
  }

  const expiresIn = 10 * 60;
  const issuedAt = nowSeconds();
  const expiresAt = issuedAt + expiresIn;

  const delegatedAccessTokenJwt = await signJwt({
    iss: getIssuer(),
    sub: subject.identityId,
    aud: resource.audience,
    exp: expiresAt,
    iat: issuedAt,
    uid: subject.userId,
    cid: sourceApp.clientId,
    scope: requestedConnectorScopes.join(" "),
    grant_id: grant.id,
    target_resource: resource.resourceKey,
    com_mode: grant.communicationMode,
    actor,
  });

  recordOAuthDelegationAuditLog(c, {
    grantId: grant.id,
    userId: subject.userId,
    sourceAppId: sourceApp.id,
    targetResourceId: resource.id,
    eventType: "token_exchanged",
    details: {
      requestedResource,
      requestedScope: requestedConnectorScopes.join(" "),
    },
  });

  return c.json({
    access_token: delegatedAccessTokenJwt,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: requestedConnectorScopes.join(" "),
    audience: resource.audience,
    target_resource: resource.resourceKey,
    communication_mode: grant.communicationMode,
  });
}
