import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, oauthApps, oauthAuthorizations, oauthRefreshTokens, identities, oauthResources, oauthDelegationGrants, organizationEncryptionPolicies, organizationIdentityMembers, organizations } from "../db";
import { requireAuth, requireWritable } from "../middleware/auth";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import { randomUUID, timingSafeEqual } from "crypto";
import { hashSessionToken } from "../lib/crypto";
import { getIssuer, getResourceAudience, getJwtPublicJwk, signJwt, verifyJwt, hashToken } from "../lib/oidc";
import { consumeAuthorizationCode, getAccessToken, getAuthorizationCode, setAccessToken, setAuthorizationCode, type AccessTokenRecord } from "../lib/oauth-store";
import { hasVerifiedEmail, serializeIdentityForApp, serializeIdentityForOwner } from "../lib/identity-serialization";
import { isOriginAllowedForApp, isRedirectUriAllowedForApp, normalizeRedirectUri } from "../lib/redirect-uri";
import { enforceRateLimits, ipRateLimit, subjectRateLimit } from "../lib/rate-limit";
import { createBusinessOrganization, hasEnterpriseSsoSessionForOrganization, scopesForRole, type BusinessRole } from "../lib/business";
import { serializeEncryptionPolicy } from "../lib/business-encryption";
import { getRequiredEnterpriseSsoForOrganization } from "../lib/enterprise-sso-policy";
import { recordActivityLog, recordAppAnalyticsEvent, recordOAuthDelegationAuditLog } from "../lib/background-events";
import {
  appEffectiveSupportsE2ee,
  isImplementedE2eeMode,
  isScopeAllowedForApp,
  resolveRequestedE2eeModeConflict,
} from "../lib/e2ee-scopes";
import { buildE2eeAuthUpdate, validateE2eeAuthPayload } from "../lib/app-e2ee-auth";
import { parseOAuthScopes, normalizeScopeToken } from "../lib/oauth-scopes";
import {
  parseOAuthPrompt,
  requiresAuthorizeInteractionPrompt,
  wantsAccountPickerPrompt,
} from "../lib/oauth-prompt";

const app = new Hono();
export const oidcRoutes = new Hono();

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  client_id: z.string().optional(),
  clientId: z.string().optional(),
  userConfirmedAveWorkspaceCreation: z.literal(true),
});

oidcRoutes.get("/webfinger", (c) => {
  const resource = c.req.query("resource");
  if (!resource) {
    return c.json({ error: "resource required" }, 400);
  }

  return c.json({
    subject: resource,
    links: [
      {
        rel: "http://openid.net/specs/connect/1.0/issuer",
        href: getIssuer(),
      },
    ],
  });
});

function getDiscoveryBase(): string {
  return process.env.OIDC_DISCOVERY_BASE || "https://api.aveid.net";
}

function publicCache(c: any, maxAgeSeconds: number): void {
  c.header("Cache-Control", `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 6}`);
  c.header("CDN-Cache-Control", `public, s-maxage=${maxAgeSeconds}`);
}

// Generate authorization code
function generateAuthCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

// Generate opaque access token
function generateAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function isValidPkceCodeVerifier(value: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  const maxLength = Math.max(aBuffer.length, bBuffer.length);
  const paddedA = Buffer.alloc(maxLength);
  const paddedB = Buffer.alloc(maxLength);
  aBuffer.copy(paddedA);
  bBuffer.copy(paddedB);
  const lengthMismatch = aBuffer.length ^ bBuffer.length;
  return timingSafeEqual(paddedA, paddedB) && lengthMismatch === 0;
}

function isClientSecretValid(expectedHash: string, clientSecret: string): boolean {
  return timingSafeEqualString(hashSessionToken(clientSecret), expectedHash);
}

function isAllowedPublicClientRequest(c: any, app: Pick<typeof oauthApps.$inferSelect, "redirectUris" | "developmentMode" | "websiteUrl">): boolean {
  const origin = c.req.header("Origin");
  return !origin || isOriginAllowedForApp(app, origin);
}

// Generate refresh token
function generateRefreshToken(): string {
  return `rt_${randomUUID().replace(/-/g, "")}`;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function parseScopes(scope: string): string[] {
  return parseOAuthScopes(scope);
}

async function getRefreshTokenFamilyIds(seedId: string): Promise<string[]> {
  const familyIds = new Set<string>([seedId]);
  let frontier = [seedId];

  while (frontier.length > 0) {
    const descendants = await db
      .select({ id: oauthRefreshTokens.id })
      .from(oauthRefreshTokens)
      .where(inArray(oauthRefreshTokens.rotatedFromId, frontier));

    frontier = descendants
      .map((token) => token.id)
      .filter((tokenId) => {
        if (familyIds.has(tokenId)) return false;
        familyIds.add(tokenId);
        return true;
      });
  }

  return [...familyIds];
}

async function markRefreshTokenFamilyReuse(seedId: string, detectedAt = new Date()): Promise<void> {
  const familyIds = await getRefreshTokenFamilyIds(seedId);
  await db
    .update(oauthRefreshTokens)
    .set({ reuseDetectedAt: detectedAt })
    .where(inArray(oauthRefreshTokens.id, familyIds));
}

function normalizeOauthTokenPayload(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const raw = input as Record<string, unknown>;

  return {
    ...raw,
    grantType: raw.grantType ?? raw.grant_type,
    redirectUri: typeof (raw.redirectUri ?? raw.redirect_uri) === "string"
      ? normalizeRedirectUri(String(raw.redirectUri ?? raw.redirect_uri))
      : raw.redirectUri ?? raw.redirect_uri,
    clientId: raw.clientId ?? raw.client_id,
    clientSecret: raw.clientSecret ?? raw.client_secret,
    codeVerifier: raw.codeVerifier ?? raw.code_verifier,
    refreshToken: raw.refreshToken ?? raw.refresh_token,
    subjectToken: raw.subjectToken ?? raw.subject_token,
    requestedResource: raw.requestedResource ?? raw.resource,
    requestedScope: raw.requestedScope ?? raw.scope,
  };
}

function getWebBase(): string {
  return process.env.RP_ORIGIN || "https://aveid.net";
}

function getApiBase(): string {
  return process.env.OIDC_DISCOVERY_BASE || "https://api.aveid.net";
}

function hasScope(scope: string, requested: string): boolean {
  return parseScopes(scope).includes(normalizeScopeToken(requested));
}

function hasAllScopes(grantedScope: string, requestedScope: string): boolean {
  const granted = new Set(parseScopes(grantedScope));
  return parseScopes(requestedScope).every((scope) => granted.has(scope));
}

function organizationClaims(record: {
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
}) {
  if (!record.organizationId) return {};
  return {
    org_id: record.organizationId,
    org_name: record.organizationName,
    org_member_id: record.organizationMemberId,
    org_role: record.organizationRole,
    org_scopes: record.organizationScopes,
    org_signing_authority: record.organizationSigningAuthority,
    org_encryption_mode: record.organizationEncryptionMode,
    org_key_custody: record.organizationKeyCustody,
    auth_method: record.organizationAuthMethod,
    sso_connection_id: record.organizationSsoConnectionId,
    auth_context: "organization",
  };
}

function organizationResponse(record: {
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
}) {
  if (!record.organizationId) return null;
  return {
    id: record.organizationId,
    name: record.organizationName,
    memberId: record.organizationMemberId,
    role: record.organizationRole,
    scopes: record.organizationScopes || [],
    signingAuthority: !!record.organizationSigningAuthority,
    encryptionMode: record.organizationEncryptionMode,
    keyCustody: record.organizationKeyCustody,
    authMethod: record.organizationAuthMethod,
    ssoConnectionId: record.organizationSsoConnectionId,
    e2eeKeyDelivery: "ave_identity_grants_only",
  };
}

function workspaceOrganizationResponse(
  organization: typeof organizations.$inferSelect,
  member: typeof organizationIdentityMembers.$inferSelect,
  encryptionPolicy: ReturnType<typeof serializeEncryptionPolicy>
) {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logoUrl: organization.logoUrl,
    role: member.role,
    scopes: scopesForRole(member.role as BusinessRole, member.scopes as string[] | null),
    signingAuthority: member.signingAuthority,
    ssoRequired: organization.ssoRequired,
    encryptionMode: encryptionPolicy.mode,
    keyCustody: keyCustodyForEncryptionMode(encryptionPolicy.mode),
  };
}

async function resolveAccessTokenRecord(token: string): Promise<AccessTokenRecord | null> {
  const stored = await getAccessToken(token);
  if (stored) return stored;

  const jwtPayload = await verifyJwt(token, getResourceAudience());
  if (!jwtPayload) return null;

  return {
    userId: typeof jwtPayload.uid === "string" ? jwtPayload.uid : "",
    identityId: String(jwtPayload.sub || ""),
    appId: String(jwtPayload.cid || ""),
    scope: String(jwtPayload.scope || ""),
    expiresAt: typeof jwtPayload.exp === "number" ? jwtPayload.exp * 1000 : 0,
    redirectUri: "",
    organizationId: typeof jwtPayload.org_id === "string" ? jwtPayload.org_id : undefined,
    organizationName: typeof jwtPayload.org_name === "string" ? jwtPayload.org_name : undefined,
    organizationMemberId: typeof jwtPayload.org_member_id === "string" ? jwtPayload.org_member_id : undefined,
    organizationRole: typeof jwtPayload.org_role === "string" ? jwtPayload.org_role : undefined,
    organizationScopes: Array.isArray(jwtPayload.org_scopes) ? jwtPayload.org_scopes.filter((scope): scope is string => typeof scope === "string") : undefined,
    organizationSigningAuthority: typeof jwtPayload.org_signing_authority === "boolean" ? jwtPayload.org_signing_authority : undefined,
    organizationEncryptionMode: typeof jwtPayload.org_encryption_mode === "string" ? jwtPayload.org_encryption_mode : undefined,
    organizationKeyCustody: typeof jwtPayload.org_key_custody === "string" ? jwtPayload.org_key_custody : undefined,
    organizationAuthMethod: typeof jwtPayload.auth_method === "string" ? jwtPayload.auth_method : undefined,
    organizationSsoConnectionId: typeof jwtPayload.sso_connection_id === "string" ? jwtPayload.sso_connection_id : undefined,
  };
}

async function resolveOauthAppForAccessRecord(record: Pick<AccessTokenRecord, "appId">) {
  const lookup = record.appId.startsWith("app_")
    ? eq(oauthApps.clientId, record.appId)
    : eq(oauthApps.id, record.appId);
  const [oauthApp] = await db.select().from(oauthApps).where(lookup).limit(1);
  return oauthApp ?? null;
}

function keyCustodyForEncryptionMode(mode: string | undefined) {
  if (mode === "e2ee") return "identity_grants";
  if (mode === "enterprise_managed") return "customer_kms";
  return "ave_standard";
}

function ensureFedCmRequest(c: any): Response | null {
  const destination = c.req.header("Sec-Fetch-Dest");
  if (destination !== "webidentity") {
    return c.json({ error: "invalid_request", error_description: "FedCM requests must include Sec-Fetch-Dest: webidentity" }, 400);
  }
  return null;
}

function setLoginStatusHeader(c: any, status: "logged-in" | "logged-out") {
  c.header("Set-Login", status);
}

async function resolveOauthAppForClient(clientId: string) {
  if (isQuickClient(clientId)) {
    return null;
  }

  const [app] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);

  return app ?? null;
}

async function issueAuthorizationCodeForApp(params: {
  userId: string;
  appId: string;
  identityId: string;
  redirectUri: string;
  scope: string;
  nonce?: string;
  encryptedAppKey?: string;
  appPublicKey?: string;
  encryptedAppPrivateKey?: string;
  appEncryptionMode?: string;
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
}) {
  const code = generateAuthCode();

  await setAuthorizationCode(code, {
    userId: params.userId,
    appId: params.appId,
    identityId: params.identityId,
    redirectUri: params.redirectUri,
    scope: params.scope,
    expiresAt: Date.now() + 10 * 60 * 1000,
    encryptedAppKey: params.encryptedAppKey,
    appPublicKey: params.appPublicKey,
    encryptedAppPrivateKey: params.encryptedAppPrivateKey,
    appEncryptionMode: params.appEncryptionMode,
    nonce: params.nonce,
    organizationId: params.organizationId,
    organizationName: params.organizationName,
    organizationMemberId: params.organizationMemberId,
    organizationRole: params.organizationRole,
    organizationScopes: params.organizationScopes,
    organizationSigningAuthority: params.organizationSigningAuthority,
    organizationEncryptionMode: params.organizationEncryptionMode,
    organizationKeyCustody: params.organizationKeyCustody,
    organizationAuthMethod: params.organizationAuthMethod,
    organizationSsoConnectionId: params.organizationSsoConnectionId,
  });

  return code;
}

async function buildTokenResponseFromAuthorizationCode(params: {
  authCode: {
    userId: string;
    identityId: string;
    scope: string;
    nonce?: string;
    encryptedAppKey?: string;
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
  };
  oauthApp: ReturnType<typeof buildQuickApp> | typeof oauthApps.$inferSelect;
  clientId: string;
  redirectUri: string;
  includeEncryptedAppKey?: boolean;
  issueRefreshToken?: boolean;
}) {
  const { authCode, oauthApp, clientId, redirectUri, includeEncryptedAppKey, issueRefreshToken = false } = params;

  const accessToken = generateAccessToken();
  const accessTokenTtl = oauthApp.accessTokenTtlSeconds || 3600;
  const refreshTokenTtl = oauthApp.refreshTokenTtlSeconds || 30 * 24 * 60 * 60;

  const accessTokenWrite = setAccessToken(accessToken, {
    userId: authCode.userId,
    identityId: authCode.identityId,
    appId: oauthApp.id,
    scope: authCode.scope,
    expiresAt: Date.now() + accessTokenTtl * 1000,
    redirectUri,
    organizationId: authCode.organizationId,
    organizationName: authCode.organizationName,
    organizationMemberId: authCode.organizationMemberId,
    organizationRole: authCode.organizationRole,
    organizationScopes: authCode.organizationScopes,
    organizationSigningAuthority: authCode.organizationSigningAuthority,
    organizationEncryptionMode: authCode.organizationEncryptionMode,
    organizationKeyCustody: authCode.organizationKeyCustody,
    organizationAuthMethod: authCode.organizationAuthMethod,
    organizationSsoConnectionId: authCode.organizationSsoConnectionId,
  });

  const identityLookup = db
    .select()
    .from(identities)
    .where(eq(identities.id, authCode.identityId))
    .limit(1);
  const [[identity]] = await Promise.all([identityLookup, accessTokenWrite]);

  const subject = authCode.identityId;
  const issuedAt = nowSeconds();
  const expiresAt = issuedAt + accessTokenTtl;

  const response: Record<string, unknown> = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: accessTokenTtl,
    scope: authCode.scope,
    user: identity ? serializeIdentityForApp(identity) : null,
  };

  const jwtAccessTokenPromise = signJwt({
    iss: getIssuer(),
    sub: subject,
    aud: getResourceAudience(),
    exp: expiresAt,
    iat: issuedAt,
    scope: authCode.scope,
    cid: oauthApp.clientId,
    uid: hasScope(authCode.scope, "user_id") ? authCode.userId : undefined,
    ...(isQuickClient(clientId) ? { quick: true } : {}),
    ...organizationClaims(authCode),
  });

  const idTokenPromise = hasScope(authCode.scope, "openid")
    ? signJwt({
      iss: getIssuer(),
      sub: subject,
      aud: oauthApp.clientId,
      exp: expiresAt,
      iat: issuedAt,
      auth_time: issuedAt,
      azp: oauthApp.clientId,
      nonce: authCode.nonce,
      name: hasScope(authCode.scope, "profile") ? identity?.displayName : undefined,
      preferred_username: hasScope(authCode.scope, "profile") ? identity?.handle : undefined,
      email: hasScope(authCode.scope, "email") ? identity?.email : undefined,
      picture: hasScope(authCode.scope, "profile") ? identity?.avatarUrl : undefined,
      ...organizationClaims(authCode),
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

  if (issueRefreshToken && hasScope(authCode.scope, "offline_access") && !isQuickClient(clientId)) {
    const refreshToken = generateRefreshToken();
    await db.insert(oauthRefreshTokens).values({
      userId: authCode.userId,
      identityId: authCode.identityId,
      appId: oauthApp.id,
      tokenHash: hashToken(refreshToken),
      scope: authCode.scope,
      expiresAt: new Date(Date.now() + refreshTokenTtl * 1000),
      organizationId: authCode.organizationId,
      organizationMemberId: authCode.organizationMemberId,
      enterpriseSsoOrganizationId: authCode.organizationAuthMethod === "enterprise_sso" ? authCode.organizationId : undefined,
      enterpriseSsoConnectionId: authCode.organizationSsoConnectionId,
    });
    response.refresh_token = refreshToken;
  }

  if (authCode.organizationId) {
    response.organization = organizationResponse(authCode);
  }

  if (includeEncryptedAppKey && authCode.encryptedAppKey) {
    response.encryptedAppKey = authCode.encryptedAppKey;
  }

  return response;
}

// ============================================
// Quick Auth helpers — no app registration required.
// clientId format: "origin:<origin>"  e.g. "origin:https://example.com"
// Security is provided by PKCE; no client secret is needed or accepted.
// ============================================
const QUICK_AUTH_ACCESS_TOKEN_TTL_SECONDS = 3600;
const QUICK_AUTH_SCOPES = ["openid", "profile", "email"];

function isQuickClient(clientId: string): boolean {
  return typeof clientId === "string" && clientId.startsWith("origin:");
}

function getQuickOrigin(clientId: string): string | null {
  try {
    const raw = clientId.slice("origin:".length);
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function buildQuickApp(clientId: string) {
  return {
    id: clientId,
    clientId,
    name: "Quick Ave",
    description: null as string | null,
    iconUrl: null as string | null,
    websiteUrl: null as string | null,
    clientSecretHash: "",
    redirectUris: [] as string[],
    allowedScopes: [...QUICK_AUTH_SCOPES],
    accessTokenTtlSeconds: QUICK_AUTH_ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: 0,
    developmentMode: false,
    supportsE2ee: false,
    ownerId: null as string | null,
    createdAt: new Date(),
  };
}


// Public: Get OAuth app info (for authorization screen)
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

app.get("/fedcm/config", async (c) => {
  c.header("Cache-Control", "public, max-age=300");

  return c.json({
    accounts_endpoint: `${getApiBase()}/api/oauth/fedcm/accounts`,
    id_assertion_endpoint: `${getApiBase()}/api/oauth/fedcm/assertion`,
    client_metadata_endpoint: `${getApiBase()}/api/oauth/fedcm/client-metadata`,
    login_url: `${getWebBase()}/login`,
  });
});

app.get("/fedcm/client-metadata", async (c) => {
  const clientId = c.req.query("client_id") || "";
  const oauthApp = await resolveOauthAppForClient(clientId);

  if (!oauthApp) {
    return c.json({ privacy_policy_url: `${getWebBase()}/privacy`, terms_of_service_url: `${getWebBase()}/terms` });
  }

  let appOrigin: string | null = null;
  try {
    appOrigin = oauthApp.websiteUrl ? new URL(oauthApp.websiteUrl).origin : null;
  } catch {
    appOrigin = null;
  }

  return c.json({
    privacy_policy_url: appOrigin ? `${appOrigin}/privacy` : `${getWebBase()}/privacy`,
    terms_of_service_url: appOrigin ? `${appOrigin}/terms` : `${getWebBase()}/terms`,
  });
});

app.get("/fedcm/accounts", async (c) => {
  const fedcmError = ensureFedCmRequest(c);
  if (fedcmError) return fedcmError;

  const user = c.get("user");
  if (!user) {
    setLoginStatusHeader(c, "logged-out");
    return c.json({ accounts: [] }, 401);
  }

  setLoginStatusHeader(c, "logged-in");

  const [userIdentities, authorizations] = await Promise.all([
    db
      .select()
      .from(identities)
      .where(eq(identities.userId, user.id)),
    db
      .select({
        identityId: oauthAuthorizations.identityId,
        clientId: oauthApps.clientId,
      })
      .from(oauthAuthorizations)
      .innerJoin(oauthApps, eq(oauthAuthorizations.appId, oauthApps.id))
      .where(eq(oauthAuthorizations.userId, user.id)),
  ]);

  const approvedClientsByIdentity = new Map<string, string[]>();
  for (const authorization of authorizations) {
    const existing = approvedClientsByIdentity.get(authorization.identityId) || [];
    existing.push(authorization.clientId);
    approvedClientsByIdentity.set(authorization.identityId, existing);
  }

  return c.json({
    accounts: userIdentities.map((identity) => ({
      id: identity.id,
      given_name: identity.displayName.split(" ")[0] || identity.displayName,
      name: identity.displayName,
      ...(identity.email ? { email: identity.email } : {}),
      picture: identity.avatarUrl || undefined,
      approved_clients: approvedClientsByIdentity.get(identity.id) || [],
      login_hints: [identity.handle, identity.id],
    })),
  });
});

app.post("/fedcm/assertion", async (c) => {
  const fedcmError = ensureFedCmRequest(c);
  if (fedcmError) return fedcmError;

  const user = c.get("user");
  if (!user) {
    setLoginStatusHeader(c, "logged-out");
    return c.json({ error: { code: "access_denied", url: `${getWebBase()}/login` } }, 401);
  }

  setLoginStatusHeader(c, "logged-in");

  const form = await c.req.parseBody();
  const clientId = String(form.client_id || "");
  const accountId = String(form.account_id || "");
  const origin = c.req.header("Origin") || "";
  const rawParams = String(form.params || "");
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "oauth:fedcm-assertion:ip", 120, 60 * 1000),
    subjectRateLimit("oauth:fedcm-assertion:user", user.id, 120, 60 * 1000),
    subjectRateLimit("oauth:fedcm-assertion:client", clientId, 120, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  let extraParams: Record<string, unknown> = {};
  if (rawParams) {
    try {
      extraParams = JSON.parse(rawParams);
    } catch {
      return c.json({ error: { code: "invalid_request", url: `${getWebBase()}/docs` } }, 400);
    }
  }

  const redirectUri = typeof extraParams.redirectUri === "string" ? normalizeRedirectUri(extraParams.redirectUri) : "";
  const scope = typeof extraParams.scope === "string" ? extraParams.scope : "openid profile email";
  const state = typeof extraParams.state === "string" ? extraParams.state : "";
  const nonce = typeof extraParams.nonce === "string" ? extraParams.nonce : undefined;
  const promptRaw = typeof extraParams.prompt === "string" ? extraParams.prompt : "";
  const oauthPrompts = parseOAuthPrompt(promptRaw);
  const forceAuthorizeInteraction = requiresAuthorizeInteractionPrompt(oauthPrompts);

  const oauthApp = await resolveOauthAppForClient(clientId);
  if (!oauthApp) {
    return c.json({ error: { code: "unauthorized_client", url: `${getWebBase()}/docs` } }, 400);
  }

  if (!origin || !isOriginAllowedForApp(oauthApp, origin)) {
    return c.json({ error: { code: "access_denied", url: `${getWebBase()}/docs` } }, 403);
  }

  if (!redirectUri || !isRedirectUriAllowedForApp(oauthApp, redirectUri)) {
    return c.json({ error: { code: "invalid_request", url: `${getWebBase()}/docs` } }, 400);
  }

  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, accountId), eq(identities.userId, user.id)))
    .limit(1);

  if (!identity) {
    return c.json({ error: { code: "access_denied", url: `${getWebBase()}/login` } }, 403);
  }

  const [existingAuth] = await db
    .select()
    .from(oauthAuthorizations)
    .where(and(
      eq(oauthAuthorizations.userId, user.id),
      eq(oauthAuthorizations.appId, oauthApp.id),
      eq(oauthAuthorizations.identityId, identity.id),
    ))
    .limit(1);

  if (
    forceAuthorizeInteraction
    || (parseScopes(scope).includes("email") && !identity.email)
    || appEffectiveSupportsE2ee(oauthApp)
    || !existingAuth
  ) {
    const continueUrl = new URL(`${getWebBase()}/signin`);
    continueUrl.searchParams.set("client_id", clientId);
    continueUrl.searchParams.set("redirect_uri", redirectUri);
    continueUrl.searchParams.set("scope", scope);
    if (state) continueUrl.searchParams.set("state", state);
    if (nonce) continueUrl.searchParams.set("nonce", nonce);
    if (promptRaw) continueUrl.searchParams.set("prompt", promptRaw);
    if (!wantsAccountPickerPrompt(oauthPrompts)) {
      continueUrl.searchParams.set("identity_id", identity.id);
    }
    continueUrl.searchParams.set("fedcm_continue", "1");

    return c.json({ continue_on: continueUrl.toString() });
  }

  const code = await issueAuthorizationCodeForApp({
    userId: user.id,
    appId: oauthApp.id,
    identityId: identity.id,
    redirectUri,
    scope,
    nonce,
    encryptedAppKey: existingAuth.encryptedAppKey || undefined,
  });

  const assertion = await signJwt({
    iss: getIssuer(),
    aud: clientId,
    sub: identity.id,
    typ: "ave_fedcm",
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state || undefined,
    nonce,
    exp: nowSeconds() + 5 * 60,
    iat: nowSeconds(),
  });

  return c.json({ token: assertion });
});

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
        description: "Quick Ave â€” authenticate without app registration",
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

// Authorization endpoint - user grants access
app.post("/authorize", requireAuth, zValidator("json", z.object({
  clientId: z.string(),
  redirectUri: z.string().transform(normalizeRedirectUri).pipe(z.string().url()),
  scope: z.string().optional().default("profile"),
  state: z.string().optional(),
  identityId: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
  codeChallenge: z.string().optional(), // PKCE
  codeChallengeMethod: z.enum(["S256", "plain"]).optional(),
  encryptedAppKey: z.string().optional(),
  appPublicKey: z.string().optional(),
  encryptedAppPrivateKey: z.string().optional(),
  nonce: z.string().optional(),
  connector: z.boolean().optional().default(false),
  requestedResource: z.string().optional(),
  requestedScope: z.string().optional(),
  communicationMode: z.enum(["user_present", "background"]).optional().default("user_present"),
  interactionMode: z.enum(["instant", "prompt"]).optional().default("prompt"),
})), async (c) => {
  const user = c.get("user")!;
  const {
    clientId,
    redirectUri,
    scope,
    state,
    identityId,
    organizationId,
    codeChallenge,
    codeChallengeMethod,
    encryptedAppKey,
    appPublicKey,
    encryptedAppPrivateKey,
    nonce,
    connector,
    requestedResource,
    requestedScope,
    communicationMode,
    interactionMode,
  } = c.req.valid("json");
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "oauth:authorize:ip", 120, 60 * 1000),
    subjectRateLimit("oauth:authorize:user", user.id, 120, 60 * 1000),
    subjectRateLimit("oauth:authorize:client", clientId, 180, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  
  // Find (or derive) the OAuth app
  const isQuick = isQuickClient(clientId);
  let oauthApp: ReturnType<typeof buildQuickApp> | typeof oauthApps.$inferSelect;

  if (isQuick) {
    const quickOrigin = getQuickOrigin(clientId);
    if (!quickOrigin) {
      return c.json({ error: "Invalid client_id" }, 400);
    }
    let redirectOrigin: string;
    try { redirectOrigin = new URL(redirectUri).origin; } catch {
      return c.json({ error: "Invalid redirect_uri" }, 400);
    }
    if (redirectOrigin !== quickOrigin) {
      return c.json({ error: "Invalid redirect_uri" }, 400);
    }
    // PKCE is mandatory for Quick Auth (there is no client secret)
    if (!codeChallenge) {
      return c.json({ error: "invalid_request", error_description: "code_challenge is required for Quick Ave" }, 400);
    }
    // Enforce strong PKCE method for Quick Ave: only S256 is allowed
    if (codeChallengeMethod !== "S256") {
      return c.json({ error: "invalid_request", error_description: "code_challenge_method must be S256 for Quick Ave" }, 400);
    }
    oauthApp = buildQuickApp(clientId);
  } else {
    const [app] = await db
      .select()
      .from(oauthApps)
      .where(eq(oauthApps.clientId, clientId))
      .limit(1);

    if (!app) {
      return c.json({ error: "Invalid client_id" }, 400);
    }
    oauthApp = app;

    // Validate redirect URI
    if (!isRedirectUriAllowedForApp(oauthApp, redirectUri)) {
      return c.json({ error: "Invalid redirect_uri" }, 400);
    }
  }

  const requestedScopes = parseScopes(scope);
  const allowedScopes = (oauthApp.allowedScopes || []) as string[];
  const invalidScopes = requestedScopes.filter(
    (s) => !isScopeAllowedForApp(s, allowedScopes),
  );
  if (invalidScopes.length > 0) {
    return c.json({ error: "invalid_scope", error_description: `Invalid scopes: ${invalidScopes.join(", ")}` }, 400);
  }

  
  // Validate identity belongs to user
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Invalid identity" }, 400);
  }

  let organizationContext: {
    organizationId: string;
    organizationName: string;
    organizationMemberId: string;
    organizationRole: string;
    organizationScopes: string[];
    organizationSigningAuthority: boolean;
    organizationEncryptionMode: string;
    organizationKeyCustody: string;
    organizationAuthMethod: string;
    organizationSsoConnectionId?: string;
  } | null = null;

  if (organizationId) {
    const [businessContext] = await db
      .select({ member: organizationIdentityMembers, organization: organizations })
      .from(organizationIdentityMembers)
      .innerJoin(organizations, eq(organizations.id, organizationIdentityMembers.organizationId))
      .where(and(
        eq(organizationIdentityMembers.organizationId, organizationId),
        eq(organizationIdentityMembers.identityId, identityId),
        eq(organizationIdentityMembers.status, "active"),
      ))
      .limit(1);

    if (!businessContext) {
      return c.json({ error: "organization_access_denied" }, 403);
    }
    if (businessContext.organization.ssoRequired && !hasEnterpriseSsoSessionForOrganization(user, organizationId)) {
      const policy = await getRequiredEnterpriseSsoForOrganization(businessContext.organization);
      return c.json({
        error: "enterprise_sso_required",
        error_description: "This organization requires enterprise SSO before issuing organization context.",
        loginUrl: policy?.loginUrl,
        organization: { id: businessContext.organization.id, name: businessContext.organization.name },
      }, 403);
    }
    const [policyRow] = await db.select().from(organizationEncryptionPolicies)
      .where(eq(organizationEncryptionPolicies.organizationId, organizationId))
      .limit(1);
    const encryptionPolicy = serializeEncryptionPolicy(policyRow ?? null, organizationId);

    organizationContext = {
      organizationId,
      organizationName: businessContext.organization.name,
      organizationMemberId: businessContext.member.id,
      organizationRole: businessContext.member.role,
      organizationScopes: scopesForRole(businessContext.member.role as BusinessRole, businessContext.member.scopes as string[] | null),
      organizationSigningAuthority: businessContext.member.signingAuthority,
      organizationEncryptionMode: encryptionPolicy.mode,
      organizationKeyCustody: keyCustodyForEncryptionMode(encryptionPolicy.mode),
      organizationAuthMethod: businessContext.organization.ssoRequired ? "enterprise_sso" : user.authMethod || "ave_session",
      organizationSsoConnectionId: businessContext.organization.ssoRequired ? user.enterpriseSsoConnectionId || undefined : undefined,
    };
  }

  if (requestedScopes.includes("email") && !hasVerifiedEmail(identity)) {
    return c.json({
      error: identity.pendingEmail
        ? "Verify your email before continuing"
        : "Add a verified email before continuing",
    }, 409);
  }

  const authorizationMethod = interactionMode === "instant"
    ? "instant"
    : user.authMethod === "passkey"
      ? "passkey"
      : user.authMethod === "trust_code" || user.authMethod === "device_approval"
      ? "fallback"
      : user.authMethod || "unknown";

  // Track authorization (skipped for Quick Auth — no persistent app record)
  let existingAuth: typeof oauthAuthorizations.$inferSelect | undefined;
  let createdAuthorization = false;
  if (!isQuick) {
    const [found] = await db
      .select()
      .from(oauthAuthorizations)
      .where(and(
        eq(oauthAuthorizations.userId, user.id),
        eq(oauthAuthorizations.appId, oauthApp.id),
        eq(oauthAuthorizations.identityId, identityId),
      ))
      .limit(1);
    existingAuth = found;

    const { mode: requestedE2eeMode, conflict: e2eeModeConflict, reset: e2eeReset } =
      resolveRequestedE2eeModeConflict(
      requestedScopes,
      oauthApp,
      existingAuth,
    );
    if (e2eeModeConflict) {
      return c.json({
        error: "invalid_scope",
        error_description: "Request only one E2EE encryption mode per authorization",
      }, 400);
    }
    if (e2eeReset && !requestedE2eeMode) {
      return c.json({
        error: "invalid_scope",
        error_description: "e2ee:reset requires an encryption mode or an existing app encryption setup",
      }, 400);
    }
    if (requestedE2eeMode && !isImplementedE2eeMode(requestedE2eeMode)) {
      return c.json({
        error: "unsupported_encryption_mode",
        error_description: `Encryption mode "${requestedE2eeMode}" is not available yet`,
      }, 400);
    }

    const e2eePayload = {
      encryptedAppKey,
      appPublicKey,
      encryptedAppPrivateKey,
    };

    if (requestedE2eeMode) {
      const validationError = validateE2eeAuthPayload(
        requestedE2eeMode,
        e2eePayload,
        existingAuth,
        { reset: e2eeReset },
      );
      if (validationError) {
        return c.json({ error: validationError }, 400);
      }
    }

    const e2eeUpdate = requestedE2eeMode
      ? buildE2eeAuthUpdate(requestedE2eeMode, e2eePayload, existingAuth, { reset: e2eeReset })
      : {};

    if (!existingAuth) {
      await db.insert(oauthAuthorizations).values({
        userId: user.id,
        appId: oauthApp.id,
        identityId,
        lastAuthorizedAt: new Date(),
        authorizationCount: 1,
        lastAuthMethod: authorizationMethod,
        encryptedAppKey: e2eeUpdate.encryptedAppKey ?? null,
        appPublicKey: e2eeUpdate.appPublicKey ?? null,
        encryptedAppPrivateKey: e2eeUpdate.encryptedAppPrivateKey ?? null,
        appEncryptionMode: e2eeUpdate.appEncryptionMode ?? null,
      });
      createdAuthorization = true;
    } else {
      await db.update(oauthAuthorizations)
        .set({
          ...e2eeUpdate,
          lastAuthorizedAt: new Date(),
          authorizationCount: existingAuth.authorizationCount + 1,
          lastAuthMethod: authorizationMethod,
        })
        .where(eq(oauthAuthorizations.id, existingAuth.id));
    }
  }

  let delegationGrantId: string | undefined;
  let resolvedRequestedScope: string | undefined;

  if (connector) {
    if (isQuick) {
      return c.json({ error: "invalid_request", error_description: "Connector flow is not supported for Quick Ave" }, 400);
    }
    if (!requestedResource || !requestedScope) {
      return c.json({ error: "invalid_request", error_description: "requestedResource and requestedScope are required for connector flow" }, 400);
    }

    const [resource] = await db
      .select()
      .from(oauthResources)
      .where(and(eq(oauthResources.resourceKey, requestedResource), eq(oauthResources.status, "active")))
      .limit(1);

    if (!resource) {
      return c.json({ error: "invalid_target", error_description: "Requested resource not found" }, 400);
    }

    const allowedResourceScopes = (resource.scopes || []) as string[];
    const requestedConnectorScopes = parseScopes(requestedScope);
    const invalidConnectorScopes = requestedConnectorScopes.filter((s) => !allowedResourceScopes.includes(s));
    if (invalidConnectorScopes.length > 0) {
      return c.json({ error: "invalid_scope", error_description: `Invalid connector scopes: ${invalidConnectorScopes.join(", ")}` }, 400);
    }

    const [existingGrant] = await db
      .select()
      .from(oauthDelegationGrants)
      .where(and(
        eq(oauthDelegationGrants.userId, user.id),
        eq(oauthDelegationGrants.identityId, identityId),
        eq(oauthDelegationGrants.sourceAppId, oauthApp.id),
        eq(oauthDelegationGrants.targetResourceId, resource.id),
        isNull(oauthDelegationGrants.revokedAt),
      ))
      .limit(1);

    if (!existingGrant) {
      const [newGrant] = await db.insert(oauthDelegationGrants).values({
        userId: user.id,
        identityId,
        sourceAppId: oauthApp.id,
        targetResourceId: resource.id,
        scope: requestedConnectorScopes.join(" "),
        communicationMode,
      }).returning();
      delegationGrantId = newGrant.id;
      resolvedRequestedScope = newGrant.scope;
    } else {
      const mergedScope = Array.from(new Set([...parseScopes(existingGrant.scope), ...requestedConnectorScopes])).join(" ");
      await db.update(oauthDelegationGrants)
        .set({
          scope: mergedScope,
          communicationMode,
          updatedAt: new Date(),
        })
        .where(eq(oauthDelegationGrants.id, existingGrant.id));
      delegationGrantId = existingGrant.id;
      resolvedRequestedScope = mergedScope;
    }

    recordOAuthDelegationAuditLog(c, {
      grantId: delegationGrantId,
      userId: user.id,
      sourceAppId: oauthApp.id,
      targetResourceId: resource.id,
      eventType: "grant_created",
      details: {
        requestedResource,
        requestedScope: requestedConnectorScopes.join(" "),
        communicationMode,
      },
    });
  }
  
  // Generate authorization code
  const code = generateAuthCode();
  
  // Get the encrypted app key to include in the auth code
  // Either from the new authorization or from an existing one
  const finalEncryptedAppKey = encryptedAppKey || existingAuth?.encryptedAppKey || undefined;
  const finalAppPublicKey = appPublicKey || existingAuth?.appPublicKey || undefined;
  const finalEncryptedAppPrivateKey =
    encryptedAppPrivateKey || existingAuth?.encryptedAppPrivateKey || undefined;
  const finalAppEncryptionMode = existingAuth?.appEncryptionMode || undefined;
  
  await setAuthorizationCode(code, {
    userId: user.id,
    appId: oauthApp.id,
    identityId,
    redirectUri,
    scope,
    expiresAt: Date.now() + 10 * 60 * 1000,
    codeChallenge,
    codeChallengeMethod,
    encryptedAppKey: finalEncryptedAppKey,
    appPublicKey: finalAppPublicKey,
    encryptedAppPrivateKey: finalEncryptedAppPrivateKey,
    appEncryptionMode: finalAppEncryptionMode,
    nonce: nonce || undefined,
    organizationId: organizationContext?.organizationId,
    organizationName: organizationContext?.organizationName,
    organizationMemberId: organizationContext?.organizationMemberId,
    organizationRole: organizationContext?.organizationRole,
    organizationScopes: organizationContext?.organizationScopes,
    organizationSigningAuthority: organizationContext?.organizationSigningAuthority,
    organizationEncryptionMode: organizationContext?.organizationEncryptionMode,
    organizationKeyCustody: organizationContext?.organizationKeyCustody,
    organizationAuthMethod: organizationContext?.organizationAuthMethod,
    organizationSsoConnectionId: organizationContext?.organizationSsoConnectionId,
    requestedResource: connector ? requestedResource : undefined,
    requestedScope: connector ? resolvedRequestedScope || requestedScope : undefined,
    communicationMode: connector ? communicationMode : undefined,
    delegationGrantId,
  });

  
  // Log activity
  recordActivityLog(c, {
    userId: user.id,
    action: "oauth_authorized",
    appId: isQuick ? null : oauthApp.id,
    details: {
      appName: oauthApp.name,
      appId: oauthApp.id,
      identityId,
      organizationId: organizationContext?.organizationId,
      authMethod: authorizationMethod,
      scope,
    },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  if (!isQuick && createdAuthorization) {
    recordAppAnalyticsEvent(c, {
      appId: oauthApp.id,
      identityId,
      eventType: "authorization_added",
      authMethod: user.authMethod || "unknown",
      severity: "info",
      metadata: { scope },
    });
  }
  
  // Build redirect URL with code
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }
  
  return c.json({ redirectUrl: redirectUrl.toString() });
});

const oauthTokenRequestSchema = z.preprocess(normalizeOauthTokenPayload, z.discriminatedUnion("grantType", [
  z.object({
    grantType: z.literal("authorization_code"),
    code: z.string(),
    redirectUri: z.string().url(),
    clientId: z.string(),
    clientSecret: z.string().optional(),
    codeVerifier: z.string().optional(), // PKCE
  }),
  z.object({
    grantType: z.literal("refresh_token"),
    refreshToken: z.string(),
    clientId: z.string(),
    clientSecret: z.string().optional(),
  }),
  z.object({
    grantType: z.literal("urn:ietf:params:oauth:grant-type:token-exchange"),
    subjectToken: z.string(),
    requestedResource: z.string(),
    requestedScope: z.string(),
    clientId: z.string(),
    clientSecret: z.string().optional(),
    actor: z.record(z.string(), z.unknown()).optional(),
  }),
]));

// Token endpoint - exchange code for access token
app.post("/token", zValidator("json", oauthTokenRequestSchema), async (c) => {
  const payload = c.req.valid("json");
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "oauth:token:ip", 300, 60 * 1000),
    subjectRateLimit("oauth:token:client", payload.clientId, 180, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  if (payload.grantType === "urn:ietf:params:oauth:grant-type:token-exchange") {
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

    let subject: {
      userId: string;
      identityId: string;
      sourceAppId: string;
      scope: string;
    } | null = null;

    const storedOpaqueSubject = await getAccessToken(subjectToken);
    if (storedOpaqueSubject) {
      subject = {
        userId: storedOpaqueSubject.userId,
        identityId: storedOpaqueSubject.identityId,
        sourceAppId: storedOpaqueSubject.appId,
        scope: storedOpaqueSubject.scope,
      };
    } else {
      const jwtPayload = await verifyJwt(subjectToken, getResourceAudience());
      if (jwtPayload) {
        const tokenClientId = String(jwtPayload.cid || "");
        const [tokenApp] = await db
          .select()
          .from(oauthApps)
          .where(eq(oauthApps.clientId, tokenClientId))
          .limit(1);

        if (tokenApp) {
          const userId = typeof jwtPayload.uid === "string" ? jwtPayload.uid : "";
          subject = {
            userId,
            identityId: String(jwtPayload.sub || ""),
            sourceAppId: tokenApp.id,
            scope: String(jwtPayload.scope || ""),
          };
        }
      }
    }

    if (!subject?.userId) {
      return c.json({ error: "invalid_grant", error_description: "Subject token is invalid" }, 400);
    }

    if (subject.sourceAppId !== sourceApp.id) {
      return c.json({ error: "invalid_grant", error_description: "Subject token does not belong to client" }, 400);
    }

    const [resource] = await db
      .select()
      .from(oauthResources)
      .where(and(eq(oauthResources.resourceKey, requestedResource), eq(oauthResources.status, "active")))
      .limit(1);

    if (!resource) {
      return c.json({ error: "invalid_target", error_description: "Requested resource not found" }, 400);
    }

    const requestedConnectorScopes = parseScopes(requestedScope);
    const invalidScopes = requestedConnectorScopes.filter((scope) => !((resource.scopes || []) as string[]).includes(scope));
    if (invalidScopes.length > 0) {
      return c.json({ error: "invalid_scope", error_description: `Invalid connector scopes: ${invalidScopes.join(", ")}` }, 400);
    }

    const [grant] = await db
      .select()
      .from(oauthDelegationGrants)
      .where(and(
        eq(oauthDelegationGrants.userId, subject.userId),
        eq(oauthDelegationGrants.identityId, subject.identityId),
        eq(oauthDelegationGrants.sourceAppId, sourceApp.id),
        eq(oauthDelegationGrants.targetResourceId, resource.id),
        isNull(oauthDelegationGrants.revokedAt),
      ))
      .limit(1);

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

  if (payload.grantType === "refresh_token") {
    const { refreshToken, clientId, clientSecret } = payload;
    const tokenHash = hashToken(refreshToken);

    const [oauthAppRows, storedRefreshRows] = await Promise.all([
      db
        .select()
        .from(oauthApps)
        .where(eq(oauthApps.clientId, clientId))
        .limit(1),
      db
        .select()
        .from(oauthRefreshTokens)
        .where(eq(oauthRefreshTokens.tokenHash, tokenHash))
        .limit(1),
    ]);
    const [oauthApp] = oauthAppRows;
    const [storedRefresh] = storedRefreshRows;

    if (!oauthApp) {
      return c.json({ error: "invalid_client", error_description: "Client not found" }, 400);
    }

    if (clientSecret) {
      if (!isClientSecretValid(oauthApp.clientSecretHash, clientSecret)) {
        return c.json({ error: "invalid_client", error_description: "Invalid client secret" }, 400);
      }
    } else if (!isAllowedPublicClientRequest(c, oauthApp)) {
      return c.json({ error: "invalid_client", error_description: "Request origin is not allowed for this client" }, 400);
    }

    if (!storedRefresh) {
      return c.json({ error: "invalid_grant", error_description: "Refresh token not found" }, 400);
    }

    if (storedRefresh.appId !== oauthApp.id) {
      return c.json({ error: "invalid_grant", error_description: "Refresh token does not belong to client" }, 400);
    }

    if (storedRefresh.revokedAt || storedRefresh.reuseDetectedAt) {
      await markRefreshTokenFamilyReuse(storedRefresh.id);
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
    const accessTokenWrite = setAccessToken(accessToken, {
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
    });
    const identityLookup = db
      .select()
      .from(identities)
      .where(eq(identities.id, storedRefresh.identityId))
      .limit(1);

    const rotatedRefreshToken = generateRefreshToken();
    await accessTokenWrite;
    await db.update(oauthRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(oauthRefreshTokens.id, storedRefresh.id));

    await db.insert(oauthRefreshTokens).values({
      userId: storedRefresh.userId,
      identityId: storedRefresh.identityId,
      appId: storedRefresh.appId,
      tokenHash: hashToken(rotatedRefreshToken),
      scope: storedRefresh.scope,
      expiresAt: new Date(Date.now() + refreshTokenTtl * 1000),
      rotatedFromId: storedRefresh.id,
      organizationId: refreshOrganizationContext.organizationId,
      organizationMemberId: refreshOrganizationContext.organizationMemberId,
      enterpriseSsoOrganizationId: refreshOrganizationContext.organizationAuthMethod === "enterprise_sso" ? refreshOrganizationContext.organizationId : undefined,
      enterpriseSsoConnectionId: refreshOrganizationContext.organizationSsoConnectionId,
    });

    const [identity] = await identityLookup;

    const issuedAt = nowSeconds();
    const expiresAt = issuedAt + accessTokenTtl;

    const idTokenPromise = signJwt({
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
    });

    const jwtAccessTokenPromise = signJwt({
      iss: getIssuer(),
      sub: storedRefresh.identityId,
      aud: getResourceAudience(),
      exp: expiresAt,
      iat: issuedAt,
      scope: storedRefresh.scope,
      cid: oauthApp.clientId,
      uid: hasScope(storedRefresh.scope, "user_id") ? storedRefresh.userId : undefined,
      ...organizationClaims(refreshOrganizationContext),
    });
    const [idToken, jwtAccessToken] = await Promise.all([idTokenPromise, jwtAccessTokenPromise]);

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

  const { code, redirectUri, clientId, clientSecret, codeVerifier } = payload;

  
  // Find authorization code
  const authCodeResult = await consumeAuthorizationCode(code);
  if (!authCodeResult.value) {
    return c.json({
      error: "invalid_grant",
      error_description: authCodeResult.expired ? "Authorization code expired" : "Authorization code not found",
    }, 400);
  }
  const authCode = authCodeResult.value;
  
  if (authCode.redirectUri !== redirectUri) {
    return c.json({ error: "invalid_grant", error_description: "Redirect URI mismatch" }, 400);
  }
  
  // Find (or derive) the OAuth app
  let oauthApp: ReturnType<typeof buildQuickApp> | typeof oauthApps.$inferSelect;
  if (isQuickClient(clientId)) {
    // Quick Auth: PKCE is mandatory — it must have been set at authorize time
    if (!authCode.codeChallenge) {
      return c.json({ error: "invalid_request", error_description: "PKCE is required for Quick Ave" }, 400);
    }
    // Validate that the redirect_uri origin matches the client_id origin
    // (mirrors the check performed at authorize time)
    const quickOrigin = getQuickOrigin(clientId);
    if (!quickOrigin) {
      return c.json({ error: "invalid_client", error_description: "Invalid client_id" }, 400);
    }
    let redirectOrigin: string;
    try { redirectOrigin = new URL(redirectUri).origin; } catch (err) {
      if (!(err instanceof TypeError)) throw err;
      return c.json({ error: "invalid_grant", error_description: "Invalid redirect_uri" }, 400);
    }
    if (redirectOrigin !== quickOrigin) {
      return c.json({ error: "invalid_grant", error_description: "redirect_uri origin does not match client_id" }, 400);
    }
    // When the browser sends an Origin header (always present for cross-origin fetch),
    // it must match the client_id origin — this cannot be forged by browser code.
    const requestOrigin = c.req.header("Origin");
    if (requestOrigin && requestOrigin !== quickOrigin) {
      return c.json({ error: "invalid_client", error_description: "Request origin does not match client_id" }, 400);
    }
    oauthApp = buildQuickApp(clientId);
  } else {
    const [app] = await db
      .select()
      .from(oauthApps)
      .where(eq(oauthApps.clientId, clientId))
      .limit(1);

    if (!app) {
      return c.json({ error: "invalid_client", error_description: "Client not found" }, 400);
    }
    oauthApp = app;
  }

  // Verify the client presenting the code is the same one that received it at
  // authorize time. For Quick clients oauthApp.id === clientId; for standard
  // clients oauthApp.id is the database UUID stored in the auth code.
  if (oauthApp.id !== authCode.appId) {
    return c.json({ error: "invalid_grant", error_description: "client_id does not match authorization" }, 400);
  }

  let clientSecretAuthenticated = false;
  let pkceAuthenticated = false;

  // Verify client secret or PKCE code verifier
  if (authCode.codeChallenge) {
    if (clientSecret) {
      if (!isClientSecretValid(oauthApp.clientSecretHash, clientSecret)) {
        return c.json({ error: "invalid_client", error_description: "Invalid client secret" }, 400);
      }
      clientSecretAuthenticated = true;
    }

    // PKCE flow
    if (!codeVerifier) {
      return c.json({ error: "invalid_request", error_description: "Code verifier required" }, 400);
    }
    if (!isValidPkceCodeVerifier(codeVerifier)) {
      return c.json({ error: "invalid_request", error_description: "Code verifier must be 43-128 characters and use the PKCE character set" }, 400);
    }
    
    let computedChallenge: string;
    if (authCode.codeChallengeMethod === "S256") {
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const hash = await crypto.subtle.digest("SHA-256", data);
      computedChallenge = Buffer.from(hash).toString("base64url");
    } else {
      computedChallenge = codeVerifier;
    }
    
    if (!timingSafeEqualString(computedChallenge, authCode.codeChallenge)) {
      return c.json({ error: "invalid_grant", error_description: "Code verifier mismatch" }, 400);
    }
    pkceAuthenticated = true;
  } else if (clientSecret) {
    // Client secret flow
    if (!isClientSecretValid(oauthApp.clientSecretHash, clientSecret)) {
      return c.json({ error: "invalid_client", error_description: "Invalid client secret" }, 400);
    }
    clientSecretAuthenticated = true;
  } else {
    return c.json({ error: "invalid_request", error_description: "Client authentication required" }, 400);
  }

  const allowedScopes = (oauthApp.allowedScopes && oauthApp.allowedScopes.length > 0
    ? oauthApp.allowedScopes
    : ["openid", "profile", "email", "offline_access"]) as string[];
  const requestedScopes = parseScopes(authCode.scope);
  const invalidScopes = requestedScopes.filter(
    (s) => !isScopeAllowedForApp(s, allowedScopes),
  );
  if (invalidScopes.length > 0) {
    return c.json({ error: "invalid_scope", error_description: `Invalid scopes: ${invalidScopes.join(", ")}` }, 400);
  }

  const response = await buildTokenResponseFromAuthorizationCode({
    authCode,
    oauthApp,
    clientId,
    redirectUri,
    issueRefreshToken: clientSecretAuthenticated || pkceAuthenticated,
  });
  
  // Note: the app key is NOT included in the JSON token response.
  // The Ave authorization UI decrypts the server-stored encrypted key using the user's master key
  // during the consent step and passes the plaintext key to the app as #app_key=... in the
  // callback redirect URL fragment — it never appears in server logs or JSON response bodies.
  
  return c.json(response);
});


oidcRoutes.get("/openid-configuration", (c) => {
  const issuer = getIssuer();
  const discoveryBase = getDiscoveryBase();
  publicCache(c, 3600);
  return c.json({
    issuer,
    authorization_endpoint: `${issuer}/signin`,
    token_endpoint: `${discoveryBase}/api/oauth/token`,
    userinfo_endpoint: `${discoveryBase}/api/oauth/userinfo`,
    jwks_uri: `${discoveryBase}/.well-known/jwks.json`,
    scopes_supported: ["openid", "profile", "email", "offline_access", "user_id"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:token-exchange"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
  });
});

oidcRoutes.get("/jwks.json", async (c) => {
  try {
    publicCache(c, 300);
    return c.json({ keys: [await getJwtPublicJwk()] });
  } catch (error) {
    return c.json({ error: "JWKS not configured" }, 500);
  }
});

// User info endpoint - get current user info
app.get("/userinfo", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "oauth:userinfo:ip", 300, 60 * 1000),
    subjectRateLimit("oauth:userinfo:token", token.slice(0, 32), 180, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  const record = await resolveAccessTokenRecord(token);
  if (!record) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.id, record.identityId))
    .limit(1);

  if (!identity) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const response: Record<string, unknown> = {
    sub: identity.id,
  };

  if (hasScope(record.scope, "profile")) {
    response.name = identity.displayName;
    response.preferred_username = identity.handle;
    response.picture = identity.avatarUrl;
  }

  if (hasScope(record.scope, "email")) {
    response.email = identity.email;
  }

  if (hasScope(record.scope, "user_id") && record.userId) {
    response.user_id = record.userId;
  }

  if (record.organizationId) {
    let organizationName = record.organizationName;
    if (!organizationName) {
      const [organization] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, record.organizationId)).limit(1);
      organizationName = organization?.name;
    }
    response.organization = organizationResponse({ ...record, organizationName });
  }

  response.iss = getIssuer();

  return c.json(response);
});

app.get("/organizations", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "oauth:organizations:ip", 180, 60 * 1000),
    subjectRateLimit("oauth:organizations:token", token.slice(0, 32), 120, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  const record = await resolveAccessTokenRecord(token);
  if (!record) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const requestedClientId = c.req.query("client_id");
  if (requestedClientId) {
    const oauthApp = await resolveOauthAppForAccessRecord(record);
    if (!oauthApp || oauthApp.clientId !== requestedClientId) {
      return c.json({ error: "invalid_client", error_description: "Token does not belong to that client" }, 403);
    }
  }

  const memberships = await db
    .select({ member: organizationIdentityMembers, organization: organizations })
    .from(organizationIdentityMembers)
    .innerJoin(organizations, eq(organizations.id, organizationIdentityMembers.organizationId))
    .where(and(
      eq(organizationIdentityMembers.identityId, record.identityId),
      eq(organizationIdentityMembers.status, "active"),
    ))
    .orderBy(desc(organizationIdentityMembers.updatedAt));

  const organizationIds = memberships.map((membership) => membership.organization.id);
  const policyRows = organizationIds.length
    ? await db.select().from(organizationEncryptionPolicies).where(inArray(organizationEncryptionPolicies.organizationId, organizationIds))
    : [];
  const policyByOrganizationId = new Map(policyRows.map((policy) => [policy.organizationId, policy]));

  return c.json({
    organizations: memberships.map(({ member, organization }) => {
      const encryptionPolicy = serializeEncryptionPolicy(policyByOrganizationId.get(organization.id) ?? null, organization.id);
      return workspaceOrganizationResponse(organization, member, encryptionPolicy);
    }),
  });
});

app.post("/workspaces", zValidator("json", createWorkspaceSchema), async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const body = c.req.valid("json");
  const requestedClientId = body.clientId ?? body.client_id;
  if (body.clientId && body.client_id && body.clientId !== body.client_id) {
    return c.json({ error: "invalid_request", error_description: "clientId and client_id must match" }, 400);
  }

  const token = authHeader.slice(7);
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "oauth:workspaces-create:ip", 30, 60 * 1000),
    subjectRateLimit("oauth:workspaces-create:token", token.slice(0, 32), 10, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  const record = await resolveAccessTokenRecord(token);
  if (!record) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const oauthApp = await resolveOauthAppForAccessRecord(record);
  if (!oauthApp) {
    return c.json({ error: "invalid_client", error_description: "Workspace creation requires a registered Ave app token" }, 403);
  }
  if (requestedClientId && oauthApp.clientId !== requestedClientId) {
    return c.json({ error: "invalid_client", error_description: "Token does not belong to that client" }, 403);
  }

  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.id, record.identityId))
    .limit(1);

  if (!identity) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const identityRateLimit = await enforceRateLimits(c, [
    subjectRateLimit("oauth:workspaces-create:identity", identity.id, 5, 60 * 1000),
  ]);
  if (identityRateLimit) return identityRateLimit;

  const created = await createBusinessOrganization(identity.userId, body.name, identity.id);
  if (!created) {
    return c.json({ error: "workspace_creation_failed" }, 400);
  }

  const encryptionPolicy = serializeEncryptionPolicy(null, created.organization.id);
  const organization = workspaceOrganizationResponse(created.organization, created.member, encryptionPolicy);

  recordActivityLog(c, {
    userId: identity.userId,
    action: "oauth_workspace_created",
    appId: oauthApp?.id,
    details: {
      organizationId: created.organization.id,
      organizationName: created.organization.name,
      identityId: identity.id,
      clientId: oauthApp?.clientId ?? requestedClientId,
      source: "oauth_workspace_endpoint",
    },
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({ organization }, 201);
});


// Session check endpoint — used by Quick Ave session monitor.
app.post("/session/check", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "invalid_token", reason: "invalid_token" }, 401);
  }

  const token = authHeader.slice(7);
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "oauth:session-check:ip", 300, 60 * 1000),
    subjectRateLimit("oauth:session-check:token", token.slice(0, 32), 120, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  // Check stored opaque access tokens first
  const record = await getAccessToken(token);
  if (record) {
    return c.json({ status: "active" });
  }

  // Fall back to JWT verification
  const jwtPayload = await verifyJwt(token, getResourceAudience());
  if (!jwtPayload) {
    return c.json({ error: "invalid_token", reason: "invalid_token" }, 401);
  }

  return c.json({ status: "active" });
});

app.post("/fedcm/finalize", requireAuth, zValidator("json", z.object({
  code: z.string(),
  clientId: z.string(),
  state: z.string().optional(),
  appKey: z.string().optional(),
  appPublicKey: z.string().optional(),
  appPrivateKey: z.string().optional(),
  appKeyOld: z.string().optional(),
  appPublicKeyOld: z.string().optional(),
  appPrivateKeyOld: z.string().optional(),
  appKeyReset: z.boolean().optional(),
})), async (c) => {
  const user = c.get("user")!;
  const {
    code,
    clientId,
    state,
    appKey,
    appPublicKey,
    appPrivateKey,
    appKeyOld,
    appPublicKeyOld,
    appPrivateKeyOld,
    appKeyReset,
  } = c.req.valid("json");
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "oauth:fedcm-finalize:ip", 120, 60 * 1000),
    subjectRateLimit("oauth:fedcm-finalize:user", user.id, 120, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  const authCodeResult = await getAuthorizationCode(code);
  if (!authCodeResult.value) {
    return c.json({ error: "invalid_grant" }, 400);
  }

  const authCode = authCodeResult.value;
  if (authCode.userId !== user.id) {
    return c.json({ error: "access_denied" }, 403);
  }

  const oauthApp = await resolveOauthAppForClient(clientId);
  if (!oauthApp || oauthApp.id !== authCode.appId) {
    return c.json({ error: "invalid_client" }, 400);
  }

  const assertion = await signJwt({
    iss: getIssuer(),
    aud: clientId,
    sub: authCode.identityId,
    typ: "ave_fedcm",
    code,
    app_key: appKey || undefined,
    app_public_key: appPublicKey || undefined,
    app_private_key: appPrivateKey || undefined,
    app_key_old: appKeyOld || undefined,
    app_public_key_old: appPublicKeyOld || undefined,
    app_private_key_old: appPrivateKeyOld || undefined,
    app_key_reset: appKeyReset ? true : undefined,
    client_id: clientId,
    redirect_uri: authCode.redirectUri,
    state: state || undefined,
    nonce: authCode.nonce,
    exp: nowSeconds() + 5 * 60,
    iat: nowSeconds(),
  });

  return c.json({ assertion });
});

app.post("/fedcm/exchange", zValidator("json", z.object({
  assertion: z.string(),
  clientId: z.string(),
})), async (c) => {
  const { assertion, clientId } = c.req.valid("json");
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "oauth:fedcm-exchange:ip", 120, 60 * 1000),
    subjectRateLimit("oauth:fedcm-exchange:client", clientId, 120, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  const assertionPayload = await verifyJwt(assertion, clientId);

  if (!assertionPayload || assertionPayload.typ !== "ave_fedcm") {
    return c.json({ error: "invalid_grant", error_description: "Invalid FedCM assertion" }, 400);
  }

  if (String(assertionPayload.client_id || "") !== clientId) {
    return c.json({ error: "invalid_client", error_description: "Client mismatch" }, 400);
  }

  const code = String(assertionPayload.code || "");
  const redirectUri = String(assertionPayload.redirect_uri || "");
  if (!code || !redirectUri) {
    return c.json({ error: "invalid_request", error_description: "Malformed FedCM assertion" }, 400);
  }

  const oauthApp = await resolveOauthAppForClient(clientId);
  if (!oauthApp) {
    return c.json({ error: "invalid_client", error_description: "Client not found" }, 400);
  }

  const authCodeResult = await consumeAuthorizationCode(code);
  if (!authCodeResult.value) {
    return c.json({
      error: "invalid_grant",
      error_description: authCodeResult.expired ? "Authorization code expired" : "Authorization code not found",
    }, 400);
  }

  const authCode = authCodeResult.value;
  if (authCode.redirectUri !== redirectUri || authCode.appId !== oauthApp.id) {
    return c.json({ error: "invalid_grant", error_description: "FedCM assertion does not match authorization" }, 400);
  }

  const response = await buildTokenResponseFromAuthorizationCode({
    authCode,
    oauthApp,
    clientId,
    redirectUri,
    includeEncryptedAppKey: true,
  });

  return c.json(response);
});

app.get("/session/bootstrap", requireAuth, async (c) => {
  const user = c.get("user")!;

  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, user.id));

  c.header("Cache-Control", "no-store");

  return c.json({
    readOnly: user.isReadOnly,
    identities: userIdentities.map(serializeIdentityForOwner),
  });
});


// List user's authorized apps (for dashboard)
app.get("/authorizations", requireAuth, async (c) => {
  const user = c.get("user")!;
  
  const authorizations = await db
    .select({
      id: oauthAuthorizations.id,
      appId: oauthAuthorizations.appId,
      identityId: oauthAuthorizations.identityId,
      createdAt: oauthAuthorizations.createdAt,
      appName: oauthApps.name,
      appIcon: oauthApps.iconUrl,
      appWebsite: oauthApps.websiteUrl,
    })
    .from(oauthAuthorizations)
    .innerJoin(oauthApps, eq(oauthAuthorizations.appId, oauthApps.id))
    .where(eq(oauthAuthorizations.userId, user.id));
  
  return c.json({ authorizations });
});

// Get authorization for a specific app (includes encrypted app key for E2EE)
app.get("/authorization/:clientId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const clientId = c.req.param("clientId") || "";

  // Quick Auth clients (origin: prefix) never have stored authorizations
  if (isQuickClient(clientId)) {
    return c.json({ authorization: null });
  }

  // Find the app
  const [oauthApp] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);
  
  if (!oauthApp) {
    return c.json({ error: "App not found" }, 404);
  }
  
  // Find existing authorization
  const [authorization] = await db
    .select()
    .from(oauthAuthorizations)
    .where(and(
      eq(oauthAuthorizations.userId, user.id),
      eq(oauthAuthorizations.appId, oauthApp.id),
    ))
    .orderBy(desc(oauthAuthorizations.lastAuthorizedAt))
    .limit(1);
  
  if (!authorization) {
    return c.json({ authorization: null });
  }
  
  return c.json({
    authorization: {
      id: authorization.id,
      identityId: authorization.identityId,
      encryptedAppKey: authorization.encryptedAppKey,
      appPublicKey: authorization.appPublicKey,
      encryptedAppPrivateKey: authorization.encryptedAppPrivateKey,
      appEncryptionMode: authorization.appEncryptionMode,
      createdAt: authorization.createdAt,
    }
  });
});

// Revoke app authorization
app.delete("/authorizations/:authId", requireAuth, requireWritable, async (c) => {
  const user = c.get("user")!;
  const authId = c.req.param("authId") || "";
  
  const [auth] = await db
    .select()
    .from(oauthAuthorizations)
    .where(and(eq(oauthAuthorizations.id, authId), eq(oauthAuthorizations.userId, user.id)))
    .limit(1);
  
  if (!auth) {
    return c.json({ error: "Authorization not found" }, 404);
  }
  
  await db.delete(oauthAuthorizations).where(eq(oauthAuthorizations.id, authId));
  
  // Get app name for logging
  const [oauthApp] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.id, auth.appId))
    .limit(1);
  
  recordActivityLog(c, {
    userId: user.id,
    action: "oauth_revoked",
    appId: auth.appId,
    details: {
      appName: oauthApp?.name,
      appId: auth.appId,
      identityId: auth.identityId,
    },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });

  recordAppAnalyticsEvent(c, {
    appId: auth.appId,
    identityId: auth.identityId,
    eventType: "authorization_revoked",
    severity: "warning",
    metadata: {},
  });
  
  return c.json({ success: true });
});

// List connector delegations for current user
app.get("/delegations", requireAuth, async (c) => {
  const user = c.get("user")!;

  const delegations = await db
    .select({
      id: oauthDelegationGrants.id,
      createdAt: oauthDelegationGrants.createdAt,
      updatedAt: oauthDelegationGrants.updatedAt,
      revokedAt: oauthDelegationGrants.revokedAt,
      communicationMode: oauthDelegationGrants.communicationMode,
      scope: oauthDelegationGrants.scope,
      sourceAppClientId: oauthApps.clientId,
      sourceAppName: oauthApps.name,
      sourceAppIconUrl: oauthApps.iconUrl,
      sourceAppWebsiteUrl: oauthApps.websiteUrl,
      targetResourceKey: oauthResources.resourceKey,
      targetResourceName: oauthResources.displayName,
      targetAudience: oauthResources.audience,
    })
    .from(oauthDelegationGrants)
    .innerJoin(oauthApps, eq(oauthDelegationGrants.sourceAppId, oauthApps.id))
    .innerJoin(oauthResources, eq(oauthDelegationGrants.targetResourceId, oauthResources.id))
    .where(eq(oauthDelegationGrants.userId, user.id));

  return c.json({ delegations });
});

// Revoke connector delegation
app.delete("/delegations/:delegationId", requireAuth, requireWritable, async (c) => {
  const user = c.get("user")!;
  const delegationId = c.req.param("delegationId") || "";

  const [grant] = await db
    .select()
    .from(oauthDelegationGrants)
    .where(and(eq(oauthDelegationGrants.id, delegationId), eq(oauthDelegationGrants.userId, user.id), isNull(oauthDelegationGrants.revokedAt)))
    .limit(1);

  if (!grant) {
    return c.json({ error: "Delegation not found" }, 404);
  }

  await db.update(oauthDelegationGrants)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(oauthDelegationGrants.id, delegationId));

  recordOAuthDelegationAuditLog(c, {
    grantId: grant.id,
    userId: grant.userId,
    sourceAppId: grant.sourceAppId,
    targetResourceId: grant.targetResourceId,
    eventType: "grant_revoked",
    details: {
      revokedByUserId: user.id,
    },
  });

  return c.json({ success: true });
});

export default app;
