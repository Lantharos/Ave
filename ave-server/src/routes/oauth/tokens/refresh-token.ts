import { and, eq, isNull } from "drizzle-orm";
import type { Context } from "hono";
import {
  db,
  identities,
  oauthApps,
  oauthAuthorizations,
  oauthRefreshTokens,
} from "../../../db";
import { isScopeAllowedForApp } from "../../../lib/identity/e2ee-scopes";
import { identityClaimsForApp } from "../../../lib/identity/identity-serialization";
import { createAccessTokenWrite, type AccessTokenRecord } from "../../../lib/oauth/oauth-store";
import { getIssuer, getResourceAudience, hashToken, signJwt } from "../../../lib/oauth/oidc";
import {
  generateAccessToken,
  generateRefreshToken,
  hasScope,
  isClientSecretValid,
  markRefreshTokenFamilyReuse,
  nowSeconds,
  parseScopes,
} from "../shared";
import type { RefreshTokenRequest } from "./token-schema";

export async function handleRefreshToken(c: Context, payload: RefreshTokenRequest) {
  const { refreshToken, clientId, clientSecret } = payload;
  const tokenHash = hashToken(refreshToken);

  const [tokenContext] = await db
    .select({
      oauthApp: oauthApps,
      storedRefresh: oauthRefreshTokens,
      identity: identities,
    })
    .from(oauthRefreshTokens)
    .innerJoin(oauthApps, and(
      eq(oauthApps.id, oauthRefreshTokens.appId),
      eq(oauthApps.clientId, clientId),
    ))
    .innerJoin(oauthAuthorizations, and(
      eq(oauthAuthorizations.id, oauthRefreshTokens.authorizationId),
      eq(oauthAuthorizations.appId, oauthRefreshTokens.appId),
      eq(oauthAuthorizations.userId, oauthRefreshTokens.userId),
      eq(oauthAuthorizations.identityId, oauthRefreshTokens.identityId),
    ))
    .leftJoin(identities, eq(identities.id, oauthRefreshTokens.identityId))
    .where(eq(oauthRefreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!tokenContext) {
    const [oauthApp] = await db
      .select({ id: oauthApps.id })
      .from(oauthApps)
      .where(eq(oauthApps.clientId, clientId))
      .limit(1);

    return oauthApp
      ? c.json({ error: "invalid_grant", error_description: "Refresh token not found" }, 400)
      : c.json({ error: "invalid_client", error_description: "Client not found" }, 400);
  }

  const { oauthApp, storedRefresh, identity } = tokenContext;

  if (!storedRefresh.familyId) {
    return c.json({ error: "invalid_grant", error_description: "Refresh token has no rotation family" }, 400);
  }

  if (parseScopes(storedRefresh.scope).some((scope) => !isScopeAllowedForApp(scope, oauthApp.allowedScopes || []))) {
    return c.json({ error: "invalid_scope", error_description: "The app no longer allows the granted scopes" }, 400);
  }

  if (clientSecret) {
    if (!isClientSecretValid(oauthApp.clientSecretHash, clientSecret)) {
      return c.json({ error: "invalid_client", error_description: "Invalid client secret" }, 400);
    }
  }

  if (storedRefresh.revokedAt || storedRefresh.reuseDetectedAt) {
    await markRefreshTokenFamilyReuse(storedRefresh.familyId);
    return c.json({ error: "invalid_grant", error_description: "Refresh token revoked" }, 400);
  }

  if (new Date() > storedRefresh.expiresAt) {
    await db.update(oauthRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(oauthRefreshTokens.id, storedRefresh.id));
    return c.json({ error: "invalid_grant", error_description: "Refresh token expired" }, 400);
  }

  const accessTokenTtl = oauthApp.accessTokenTtlSeconds || 3600;
  const refreshTokenTtl = oauthApp.refreshTokenTtlSeconds || 30 * 24 * 60 * 60;

  const accessToken = generateAccessToken();
  const accessTokenRecord: AccessTokenRecord = {
    authorizationId: storedRefresh.authorizationId!,
    userId: storedRefresh.userId,
    identityId: storedRefresh.identityId,
    appId: storedRefresh.appId,
    scope: storedRefresh.scope,
    expiresAt: Date.now() + accessTokenTtl * 1000,
    redirectUri: "",
  };
  const rotatedRefreshToken = generateRefreshToken();
  const issuedAt = nowSeconds();
  const expiresAt = issuedAt + accessTokenTtl;
  const [claimedRefresh, idToken, jwtAccessToken] = await Promise.all([
    db.update(oauthRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(oauthRefreshTokens.id, storedRefresh.id),
        isNull(oauthRefreshTokens.revokedAt),
        isNull(oauthRefreshTokens.reuseDetectedAt),
      ))
      .returning({ id: oauthRefreshTokens.id }),
    hasScope(storedRefresh.scope, "openid") ? signJwt({
      iss: getIssuer(),
      sub: storedRefresh.identityId,
      aud: oauthApp.clientId,
      exp: expiresAt,
      iat: issuedAt,
      auth_time: issuedAt,
      azp: oauthApp.clientId,
      ...(identity ? identityClaimsForApp(identity, storedRefresh.scope) : {}),
    }) : Promise.resolve(null),
    signJwt({
      iss: getIssuer(),
      jti: accessToken,
      sub: storedRefresh.identityId,
      aud: getResourceAudience(),
      exp: expiresAt,
      iat: issuedAt,
      scope: storedRefresh.scope,
      cid: oauthApp.clientId,
      uid: hasScope(storedRefresh.scope, "user_id") ? storedRefresh.userId : undefined,
    }),
  ]);

  if (!claimedRefresh.length) {
    await markRefreshTokenFamilyReuse(storedRefresh.familyId);
    return c.json({ error: "invalid_grant", error_description: "Refresh token was already used" }, 400);
  }

  await db.batch([
    createAccessTokenWrite(accessToken, accessTokenRecord),
    db.insert(oauthRefreshTokens).values({
      authorizationId: storedRefresh.authorizationId,
      userId: storedRefresh.userId,
      identityId: storedRefresh.identityId,
      appId: storedRefresh.appId,
      tokenHash: hashToken(rotatedRefreshToken),
      scope: storedRefresh.scope,
      expiresAt: new Date(Date.now() + refreshTokenTtl * 1000),
      familyId: storedRefresh.familyId,
      rotatedFromId: storedRefresh.id,
    }),
  ]);

  const response: Record<string, unknown> = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: accessTokenTtl,
    scope: storedRefresh.scope,
    refresh_token: rotatedRefreshToken,
    access_token_jwt: jwtAccessToken,
  };

  if (idToken) response.id_token = idToken;

  if (hasScope(storedRefresh.scope, "user_id")) {
    response.user_id = storedRefresh.userId;
  }


  return c.json(response);
}
