import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, identities, oauthApps, oauthRefreshTokens } from "../../../db";
import { identityClaimsForApp, serializeIdentityForApp } from "../../../lib/identity/identity-serialization";
import { createAccessTokenWrite, type AuthorizationCodeRecord } from "../../../lib/oauth/oauth-store";
import { getIssuer, getResourceAudience, hashToken, signJwt } from "../../../lib/oauth/oidc";
import {
  generateAccessToken,
  generateRefreshToken,
  hasScope,
  nowSeconds,
} from "../shared";

export async function buildTokenResponseFromAuthorizationCode(params: {
  authCode: AuthorizationCodeRecord;
  oauthApp: typeof oauthApps.$inferSelect;
  redirectUri: string;
  issueRefreshToken?: boolean;
}) {
  const { authCode, oauthApp, redirectUri, issueRefreshToken = false } = params;

  const accessToken = generateAccessToken();
  const accessTokenTtl = oauthApp.accessTokenTtlSeconds || 3600;
  const refreshTokenTtl = oauthApp.refreshTokenTtlSeconds || 30 * 24 * 60 * 60;
  const issuedAt = nowSeconds();
  const expiresAt = issuedAt + accessTokenTtl;
  const shouldIssueRefreshToken = issueRefreshToken && hasScope(authCode.scope, "offline_access");
  const refreshToken = shouldIssueRefreshToken ? generateRefreshToken() : null;
  const refreshTokenId = shouldIssueRefreshToken ? randomUUID() : null;

  const accessTokenWrite = createAccessTokenWrite(accessToken, {
    authorizationId: authCode.authorizationId,
    userId: authCode.userId,
    identityId: authCode.identityId,
    appId: oauthApp.id,
    scope: authCode.scope,
    expiresAt: Date.now() + accessTokenTtl * 1000,
    redirectUri,
  });

  const identityLookup = db
    .select()
    .from(identities)
    .where(eq(identities.id, authCode.identityId))
    .limit(1);

  async function persistTokenState() {
    if (refreshToken && refreshTokenId) {
      const [identityRows] = await Promise.all([
        identityLookup,
        db.batch([
          accessTokenWrite,
          db.insert(oauthRefreshTokens).values({
            id: refreshTokenId,
            authorizationId: authCode.authorizationId,
            familyId: refreshTokenId,
            userId: authCode.userId,
            identityId: authCode.identityId,
            appId: oauthApp.id,
            tokenHash: hashToken(refreshToken),
            scope: authCode.scope,
            expiresAt: new Date(Date.now() + refreshTokenTtl * 1000),
          }),
        ]),
      ]);
      return identityRows[0];
    }

    const [identityRows] = await Promise.all([identityLookup, accessTokenWrite]);
    return identityRows[0];
  }

  const identityPromise = persistTokenState();
  const jwtAccessTokenPromise = signJwt({
    iss: getIssuer(),
    jti: accessToken,
    sub: authCode.identityId,
    aud: getResourceAudience(),
    exp: expiresAt,
    iat: issuedAt,
    scope: authCode.scope,
    cid: oauthApp.clientId,
    uid: hasScope(authCode.scope, "user_id") ? authCode.userId : undefined,
  });
  const identity = await identityPromise;

  const response: Record<string, unknown> = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: accessTokenTtl,
    scope: authCode.scope,
    user: identity ? serializeIdentityForApp(identity, authCode.scope) : null,
  };

  const idTokenPromise = hasScope(authCode.scope, "openid")
    ? signJwt({
      iss: getIssuer(),
      sub: authCode.identityId,
      aud: oauthApp.clientId,
      exp: expiresAt,
      iat: issuedAt,
      auth_time: issuedAt,
      azp: oauthApp.clientId,
      nonce: authCode.nonce,
      ...(identity ? identityClaimsForApp(identity, authCode.scope) : {}),
    })
    : Promise.resolve(null);

  const [jwtAccessToken, idToken] = await Promise.all([jwtAccessTokenPromise, idTokenPromise]);
  response.access_token_jwt = jwtAccessToken;

  if (hasScope(authCode.scope, "user_id")) {
    response.user_id = authCode.userId;
  }

  if (idToken) {
    response.id_token = idToken;
  }

  if (refreshToken) {
    response.refresh_token = refreshToken;
  }

  return response;
}
