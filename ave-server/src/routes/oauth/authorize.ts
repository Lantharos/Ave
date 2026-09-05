import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  db,
  identities,
  oauthApps,
  oauthAuthorizations,
  oauthDelegationGrants,
  oauthResources,
  organizationEncryptionPolicies,
  organizationIdentityMembers,
  organizations,
} from "../../db";
import { buildE2eeAuthUpdate, validateE2eeAuthPayload } from "../../lib/app-e2ee-auth";
import { recordActivityLog, recordAppAnalyticsEvent, recordOAuthDelegationAuditLog } from "../../lib/background-events";
import { hasEnterpriseSsoSessionForOrganization, scopesForRole, type BusinessRole } from "../../lib/business";
import { serializeEncryptionPolicy } from "../../lib/business-encryption";
import type { E2eeMode } from "../../lib/e2ee-scopes";
import {
  isImplementedE2eeMode,
  isScopeAllowedForApp,
  resolveRequestedE2eeModeConflict,
} from "../../lib/e2ee-scopes";
import { getRequiredEnterpriseSsoForOrganization } from "../../lib/enterprise-sso-policy";
import { hasVerifiedEmail } from "../../lib/identity-serialization";
import { createAuthorizationCodeWrite } from "../../lib/oauth-store";
import { enforceNativeRateLimits, getClientIp, ipRateLimit, subjectRateLimit } from "../../lib/rate-limit";
import { isRedirectUriAllowedForApp, normalizeRedirectUri } from "../../lib/redirect-uri";
import { requireAuth } from "../../middleware/auth";
import {
  buildQuickApp,
  generateAuthCode,
  getQuickOrigin,
  isQuickClient,
  keyCustodyForEncryptionMode,
  parseScopes,
} from "./shared";

const app = new Hono();


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
  const rateLimitResponse = await enforceNativeRateLimits(c, [
    {
      binding: "OAUTH_AUTHORIZE_ACTOR_RATE_LIMITER",
      key: `ip:${getClientIp(c)}`,
      periodSeconds: 60,
      fallback: ipRateLimit(c, "oauth:authorize:ip", 120, 60 * 1000),
    },
    {
      binding: "OAUTH_AUTHORIZE_ACTOR_RATE_LIMITER",
      key: `user:${user.id}`,
      periodSeconds: 60,
      fallback: subjectRateLimit("oauth:authorize:user", user.id, 120, 60 * 1000),
    },
    {
      binding: "OAUTH_CLIENT_RATE_LIMITER",
      key: `authorize:${clientId}`,
      periodSeconds: 60,
      fallback: subjectRateLimit("oauth:authorize:client", clientId, 180, 60 * 1000),
    },
  ]);
  if (rateLimitResponse) return rateLimitResponse;


  // Find (or derive) the OAuth app
  const isQuick = isQuickClient(clientId);
  let oauthApp: ReturnType<typeof buildQuickApp> | typeof oauthApps.$inferSelect;
  let identity: typeof identities.$inferSelect | null;
  let existingAuth: typeof oauthAuthorizations.$inferSelect | null = null;

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
    const [quickIdentity] = await db
      .select()
      .from(identities)
      .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
      .limit(1);
    identity = quickIdentity ?? null;
  } else {
    const [authorizationContext] = await db
      .select({
        oauthApp: oauthApps,
        identity: identities,
        authorization: oauthAuthorizations,
      })
      .from(oauthApps)
      .leftJoin(identities, and(
        eq(identities.id, identityId),
        eq(identities.userId, user.id),
      ))
      .leftJoin(oauthAuthorizations, and(
        eq(oauthAuthorizations.userId, user.id),
        eq(oauthAuthorizations.appId, oauthApps.id),
        eq(oauthAuthorizations.identityId, identityId),
      ))
      .where(eq(oauthApps.clientId, clientId))
      .limit(1);

    if (!authorizationContext) {
      return c.json({ error: "Invalid client_id" }, 400);
    }
    oauthApp = authorizationContext.oauthApp;
    identity = authorizationContext.identity;
    existingAuth = authorizationContext.authorization;

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
  let createdAuthorization = false;
  let authorizationId = existingAuth?.id;
  let authorizationUpdate: {
    id: string;
    e2ee: ReturnType<typeof buildE2eeAuthUpdate>;
  } | null = null;
  let authorizedE2eeMode: E2eeMode | null = null;
  let resetsE2ee = false;
  if (!isQuick) {
    const { mode: requestedE2eeMode, conflict: e2eeModeConflict, reset: e2eeReset } =
      resolveRequestedE2eeModeConflict(
      requestedScopes,
      oauthApp,
      existingAuth,
    );
    authorizedE2eeMode = requestedE2eeMode;
    resetsE2ee = e2eeReset;
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
      const inserted = await db.insert(oauthAuthorizations).values({
        scope: requestedScopes.join(" "),
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
      })
        .onConflictDoNothing({
          target: [oauthAuthorizations.userId, oauthAuthorizations.appId, oauthAuthorizations.identityId],
        })
        .returning({ id: oauthAuthorizations.id });
      createdAuthorization = inserted.length > 0;
      authorizationId = inserted[0]?.id;

      if (!createdAuthorization) {
        const [concurrentAuthorization] = await db
          .select()
          .from(oauthAuthorizations)
          .where(and(
            eq(oauthAuthorizations.userId, user.id),
            eq(oauthAuthorizations.appId, oauthApp.id),
            eq(oauthAuthorizations.identityId, identityId),
          ))
          .limit(1);

        if (!concurrentAuthorization) {
          return c.json({
            error: "authorization_conflict",
            error_description: "The authorization changed while it was being created. Please try again.",
          }, 409);
        }

        if (requestedE2eeMode) {
          const validationError = validateE2eeAuthPayload(
            requestedE2eeMode,
            e2eePayload,
            concurrentAuthorization,
            { reset: e2eeReset },
          );
          if (validationError) {
            return c.json({
              error: "authorization_conflict",
              error_description: `${validationError}. Reload the authorization and try again.`,
            }, 409);
          }
        }

        existingAuth = concurrentAuthorization;
        authorizationId = concurrentAuthorization.id;
        authorizationUpdate = {
          id: concurrentAuthorization.id,
          e2ee: requestedE2eeMode
            ? buildE2eeAuthUpdate(
              requestedE2eeMode,
              e2eePayload,
              concurrentAuthorization,
              { reset: e2eeReset },
            )
            : {},
        };
      }
    } else {
      authorizationUpdate = {
        id: existingAuth.id,
        e2ee: e2eeUpdate,
      };
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
        authorizationId,
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
  const finalEncryptedAppKey = (
    resetsE2ee
      ? encryptedAppKey
      : existingAuth?.encryptedAppKey || encryptedAppKey
  ) || undefined;
  const finalAppPublicKey = (
    resetsE2ee
      ? appPublicKey
      : existingAuth?.appPublicKey || appPublicKey
  ) || undefined;
  const finalEncryptedAppPrivateKey =
    (resetsE2ee
      ? encryptedAppPrivateKey
      : existingAuth?.encryptedAppPrivateKey || encryptedAppPrivateKey) || undefined;
  const finalAppEncryptionMode = authorizedE2eeMode || existingAuth?.appEncryptionMode || undefined;

  const authorizationCodeWrite = createAuthorizationCodeWrite(code, {
    authorizationId,
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

  if (authorizationUpdate) {
    await db.batch([
      db.update(oauthAuthorizations)
        .set({
          ...authorizationUpdate.e2ee,
          scope: [...new Set([...parseScopes(existingAuth?.scope || ""), ...requestedScopes])].join(" "),
          lastAuthorizedAt: new Date(),
          authorizationCount: sql`${oauthAuthorizations.authorizationCount} + 1`,
          lastAuthMethod: authorizationMethod,
        })
        .where(eq(oauthAuthorizations.id, authorizationUpdate.id)),
      authorizationCodeWrite,
    ]);
  } else {
    await authorizationCodeWrite;
  }


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

export default app;
