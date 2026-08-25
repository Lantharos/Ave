import type { Context } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  identities,
  oauthApps,
  oauthRefreshTokens,
  organizationEncryptionPolicies,
  organizationIdentityMembers,
  organizations,
} from "../../db";
import { serializeEncryptionPolicy } from "../../lib/business-encryption";
import { scopesForRole, type BusinessRole } from "../../lib/business";
import { getRequiredEnterpriseSsoForOrganization } from "../../lib/enterprise-sso-policy";
import { getIssuer, getResourceAudience, hashToken, signJwt } from "../../lib/oidc";
import { createAccessTokenWrite, type AccessTokenRecord } from "../../lib/oauth-store";
import {
  generateAccessToken,
  generateRefreshToken,
  hasScope,
  isAllowedPublicClientRequest,
  isClientSecretValid,
  keyCustodyForEncryptionMode,
  markRefreshTokenFamilyReuse,
  nowSeconds,
  organizationClaims,
  organizationResponse,
} from "./shared";
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

  if (clientSecret) {
    if (!isClientSecretValid(oauthApp.clientSecretHash, clientSecret)) {
      return c.json({ error: "invalid_client", error_description: "Invalid client secret" }, 400);
    }
  } else if (!isAllowedPublicClientRequest(c, oauthApp)) {
    return c.json({ error: "invalid_client", error_description: "Request origin is not allowed for this client" }, 400);
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

  let refreshOrganizationContext: ReturnType<typeof organizationClaims> & {
    organizationId?: string;
    organizationName?: string;
    organizationMemberId?: string;
    organizationRole?: string;
    organizationScopes?: string[];
    organizationSigningAuthority?: boolean;
    organizationEncryptionMode?: string;
    organizationKeyCustody?: string;
    organizationAuthMethod?: string;
    organizationSsoConnectionId?: string;
  } = {};

  if (storedRefresh.organizationId && storedRefresh.organizationMemberId) {
    const [businessContextRows, policyRows] = await Promise.all([
      db
        .select({ member: organizationIdentityMembers, organization: organizations })
        .from(organizationIdentityMembers)
        .innerJoin(organizations, eq(organizations.id, organizationIdentityMembers.organizationId))
        .where(and(
          eq(organizationIdentityMembers.id, storedRefresh.organizationMemberId),
          eq(organizationIdentityMembers.organizationId, storedRefresh.organizationId),
          eq(organizationIdentityMembers.identityId, storedRefresh.identityId),
          eq(organizationIdentityMembers.status, "active"),
        ))
        .limit(1),
      db.select().from(organizationEncryptionPolicies)
        .where(eq(organizationEncryptionPolicies.organizationId, storedRefresh.organizationId))
        .limit(1),
    ]);
    const [businessContext] = businessContextRows;
    const [policyRow] = policyRows;

    if (!businessContext) {
      return c.json({ error: "access_denied", error_description: "Organization membership is no longer active" }, 403);
    }
    if (businessContext.organization.ssoRequired && storedRefresh.enterpriseSsoOrganizationId !== storedRefresh.organizationId) {
      const policy = await getRequiredEnterpriseSsoForOrganization(businessContext.organization);
      return c.json({
        error: "enterprise_sso_required",
        error_description: "This organization now requires enterprise SSO before refreshing organization context.",
        loginUrl: policy?.loginUrl,
        organization: { id: businessContext.organization.id, name: businessContext.organization.name },
      }, 403);
    }
    const encryptionPolicy = serializeEncryptionPolicy(policyRow ?? null, storedRefresh.organizationId);

    refreshOrganizationContext = {
      organizationId: storedRefresh.organizationId,
      organizationName: businessContext.organization.name,
      organizationMemberId: storedRefresh.organizationMemberId,
      organizationRole: businessContext.member.role,
      organizationScopes: scopesForRole(businessContext.member.role as BusinessRole, businessContext.member.scopes as string[] | null),
      organizationSigningAuthority: businessContext.member.signingAuthority,
      organizationEncryptionMode: encryptionPolicy.mode,
      organizationKeyCustody: keyCustodyForEncryptionMode(encryptionPolicy.mode),
      organizationAuthMethod: businessContext.organization.ssoRequired ? "enterprise_sso" : "ave_session",
      organizationSsoConnectionId: businessContext.organization.ssoRequired ? storedRefresh.enterpriseSsoConnectionId || undefined : undefined,
    };
  }

  const accessTokenTtl = oauthApp.accessTokenTtlSeconds || 3600;
  const refreshTokenTtl = oauthApp.refreshTokenTtlSeconds || 30 * 24 * 60 * 60;

  const accessToken = generateAccessToken();
  const accessTokenRecord: AccessTokenRecord = {
    userId: storedRefresh.userId,
    identityId: storedRefresh.identityId,
    appId: storedRefresh.appId,
    scope: storedRefresh.scope,
    expiresAt: Date.now() + accessTokenTtl * 1000,
    redirectUri: "",
    organizationId: refreshOrganizationContext.organizationId,
    organizationName: refreshOrganizationContext.organizationName,
    organizationMemberId: refreshOrganizationContext.organizationMemberId,
    organizationRole: refreshOrganizationContext.organizationRole,
    organizationScopes: refreshOrganizationContext.organizationScopes,
    organizationSigningAuthority: refreshOrganizationContext.organizationSigningAuthority,
    organizationEncryptionMode: refreshOrganizationContext.organizationEncryptionMode,
    organizationKeyCustody: refreshOrganizationContext.organizationKeyCustody,
    organizationAuthMethod: refreshOrganizationContext.organizationAuthMethod,
    organizationSsoConnectionId: refreshOrganizationContext.organizationSsoConnectionId,
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
    signJwt({
      iss: getIssuer(),
      sub: storedRefresh.identityId,
      aud: oauthApp.clientId,
      exp: expiresAt,
      iat: issuedAt,
      auth_time: issuedAt,
      azp: oauthApp.clientId,
      name: hasScope(storedRefresh.scope, "profile") ? identity?.displayName : undefined,
      preferred_username: hasScope(storedRefresh.scope, "profile") ? identity?.handle : undefined,
      email: hasScope(storedRefresh.scope, "email") ? identity?.email : undefined,
      picture: hasScope(storedRefresh.scope, "profile") ? identity?.avatarUrl : undefined,
      ...organizationClaims(refreshOrganizationContext),
    }),
    signJwt({
      iss: getIssuer(),
      sub: storedRefresh.identityId,
      aud: getResourceAudience(),
      exp: expiresAt,
      iat: issuedAt,
      scope: storedRefresh.scope,
      cid: oauthApp.clientId,
      uid: hasScope(storedRefresh.scope, "user_id") ? storedRefresh.userId : undefined,
      ...organizationClaims(refreshOrganizationContext),
    }),
  ]);

  if (!claimedRefresh.length) {
    await markRefreshTokenFamilyReuse(storedRefresh.familyId);
    return c.json({ error: "invalid_grant", error_description: "Refresh token was already used" }, 400);
  }

  await db.batch([
    createAccessTokenWrite(accessToken, accessTokenRecord),
    db.insert(oauthRefreshTokens).values({
      userId: storedRefresh.userId,
      identityId: storedRefresh.identityId,
      appId: storedRefresh.appId,
      tokenHash: hashToken(rotatedRefreshToken),
      scope: storedRefresh.scope,
      expiresAt: new Date(Date.now() + refreshTokenTtl * 1000),
      familyId: storedRefresh.familyId,
      rotatedFromId: storedRefresh.id,
      organizationId: refreshOrganizationContext.organizationId,
      organizationMemberId: refreshOrganizationContext.organizationMemberId,
      enterpriseSsoOrganizationId: refreshOrganizationContext.organizationAuthMethod === "enterprise_sso" ? refreshOrganizationContext.organizationId : undefined,
      enterpriseSsoConnectionId: refreshOrganizationContext.organizationSsoConnectionId,
    }),
  ]);

  const response: Record<string, unknown> = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: accessTokenTtl,
    refresh_token: rotatedRefreshToken,
    id_token: idToken,
    access_token_jwt: jwtAccessToken,
  };

  if (hasScope(storedRefresh.scope, "user_id")) {
    response.user_id = storedRefresh.userId;
  }

  if (refreshOrganizationContext.organizationId) {
    response.organization = organizationResponse(refreshOrganizationContext);
  }

  return c.json(response);
}
