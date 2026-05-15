import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  db,
  organizationDomainVerifications,
  organizationIdentityMembers,
  organizations,
  organizationSsoConnections,
} from "../db";
import { requireAuth, requireWritableForMutation } from "../middleware/auth";
import {
  buildAuditPayload,
  hasBusinessScope,
  requireBusinessAccess,
  shouldRequireEnterpriseSsoForBusinessAccess,
  verifySignedBusinessAction,
  writeBusinessAuditEvent,
} from "../lib/business";
import {
  decryptSsoClientSecret,
  encryptSsoClientSecret,
  oidcCallbackUrl,
  pkceChallenge,
  randomBase64Url,
  resolveOidcConfig,
  verifyOidcIdToken,
} from "../lib/business-oidc";
import {
  buildSamlServiceProviderUrls,
  serializeSsoConnection,
} from "../lib/sso-metadata";
import { completeEnterpriseSsoLogin, recordSsoConnectionTest } from "../lib/business-sso-login";
import { clientIp, userAgent, verificationToken, verifyDnsTxt } from "../lib/business-route-utils";
import { deleteChallenge, getChallenge, setChallenge } from "../lib/challenge-store";
import { businessOrigin, enterpriseSsoReturnTo } from "../lib/enterprise-sso-return";
import { getRequiredEnterpriseSsoForEmail, getRequiredEnterpriseSsoForOrganization } from "../lib/enterprise-sso-policy";

const app = new Hono();

const domainSchema = z.string()
  .min(3)
  .max(253)
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.string().regex(/^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/));
const signedActionSchema = z.object({ signature: z.string().min(1).max(2000) }).optional();
type EnterpriseSsoState = {
  connectionId: string;
  mode: "login" | "test";
  nonce?: string;
  codeVerifier?: string;
  returnTo?: string;
};

async function requireSignedAction(c: any, actorIdentityId: string, action: string, details: Record<string, unknown>, signature?: string) {
  if (!signature) return c.json({ error: "Action signature required" }, 400);
  const result = await verifySignedBusinessAction({
    actorIdentityId,
    payload: buildAuditPayload(action, details),
    signature,
  });
  if (result.status === "verified") return null;
  if (result.status === "missing_key") return c.json({ error: "Acting identity needs a signing key" }, 400);
  return c.json({ error: "Invalid action signature" }, 400);
}

function rejectWithoutSigningAuthority(c: any, member: { signingAuthority: boolean }) {
  if (member.signingAuthority) return null;
  return c.json({ error: "Signing authority required" }, 403);
}

async function rejectWithoutRequiredSso(c: any, access: NonNullable<Awaited<ReturnType<typeof requireBusinessAccess>>>) {
  const user = c.get("user")!;
  if (!shouldRequireEnterpriseSsoForBusinessAccess(user, access)) return null;
  const policy = await getRequiredEnterpriseSsoForOrganization(access.organization);
  return c.json({
    error: "enterprise_sso_required",
    loginUrl: policy?.loginUrl,
    organization: { id: access.organization.id, name: access.organization.name },
  }, 403);
}

async function rejectSsoTestAccess(c: any, organizationId: string) {
  const user = c.get("user");
  if (!user) return c.text("Sign in to Ave before testing SSO", 401);
  if (user.isReadOnly) return c.text("Demo account is read-only", 403);
  const access = await requireBusinessAccess(user.id, organizationId, "admin");
  if (!access || !hasBusinessScope(access.member, "manage_sso")) return c.text("Organization not found", 404);
  const ssoError = await rejectWithoutRequiredSso(c, access);
  if (ssoError) return ssoError;
  return null;
}

app.post("/sso/discover", zValidator("json", z.object({ email: z.string().email() })), async (c) => {
  const sso = await getRequiredEnterpriseSsoForEmail(c.req.valid("json").email);
  if (!sso) {
    return c.json({ ssoRequired: false, loginAvailable: false });
  }

  return c.json({
    ssoRequired: true,
    loginAvailable: true,
    loginUrl: sso.loginUrl,
    organization: sso.organization,
    connection: serializeSsoConnection(sso.connection),
  });
});

app.get("/sso/oidc/:connectionId/start", async (c) => {
  const connectionId = c.req.param("connectionId");
  const mode = c.req.query("mode") === "test" ? "test" : "login";
  const returnTo = enterpriseSsoReturnTo(c.req.query("return_to"));
  const [row] = await db
    .select({ connection: organizationSsoConnections, organization: organizations })
    .from(organizationSsoConnections)
    .innerJoin(organizations, eq(organizations.id, organizationSsoConnections.organizationId))
    .where(and(eq(organizationSsoConnections.id, connectionId), eq(organizationSsoConnections.type, "oidc")))
    .limit(1);

  if (!row) return c.text("OIDC connection not found", 404);
  if (mode === "login" && row.connection.status !== "active") return c.text("OIDC connection is not active", 409);
  if (mode === "test") {
    const accessError = await rejectSsoTestAccess(c, row.organization.id);
    if (accessError) return accessError;
  }

  const config = await resolveOidcConfig(row.connection);
  const state = randomBase64Url();
  const nonce = randomBase64Url();
  const codeVerifier = randomBase64Url();
  await setChallenge<EnterpriseSsoState>("business-oidc", state, { connectionId, nonce, codeVerifier, mode, returnTo }, 10 * 60 * 1000);

  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", oidcCallbackUrl(connectionId));
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", await pkceChallenge(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  return c.redirect(url.toString(), 302);
});

app.get("/sso/oidc/:connectionId/callback", async (c) => {
  const connectionId = c.req.param("connectionId");
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) return c.text("Missing OIDC callback parameters", 400);

  const stored = await getChallenge<EnterpriseSsoState>("business-oidc", state);
  await deleteChallenge("business-oidc", state);
  if (!stored || stored.connectionId !== connectionId) return c.text("OIDC login expired", 400);
  if (!stored.codeVerifier || !stored.nonce) return c.text("OIDC login expired", 400);

  const [row] = await db
    .select({ connection: organizationSsoConnections, organization: organizations })
    .from(organizationSsoConnections)
    .innerJoin(organizations, eq(organizations.id, organizationSsoConnections.organizationId))
    .where(and(eq(organizationSsoConnections.id, connectionId), eq(organizationSsoConnections.type, "oidc")))
    .limit(1);
  if (!row) return c.text("OIDC connection not found", 404);

  const config = await resolveOidcConfig(row.connection);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: oidcCallbackUrl(connectionId),
    client_id: config.clientId,
    code_verifier: stored.codeVerifier,
  });
  const clientSecret = await decryptSsoClientSecret(row.connection.encryptedClientSecret);
  if (clientSecret) body.set("client_secret", clientSecret);

  const tokenResponse = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  if (!tokenResponse.ok) return c.text("OIDC token exchange failed", 400);
  const tokenSet = await tokenResponse.json() as { id_token?: string };
  if (!tokenSet.id_token) return c.text("OIDC provider did not return an ID token", 400);

  const claims = await verifyOidcIdToken({ idToken: tokenSet.id_token, config, nonce: stored.nonce });
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!email || claims.email_verified === false) return c.text("OIDC email is missing or unverified", 400);
  const emailDomain = email.split("@").pop() || "";
  if (row.connection.domain && emailDomain !== row.connection.domain) return c.text("OIDC email domain is not allowed for this organization", 403);

  if (stored.mode === "test") {
    const accessError = await rejectSsoTestAccess(c, row.organization.id);
    if (accessError) return accessError;
    const user = c.get("user")!;
    const access = await requireBusinessAccess(user.id, row.organization.id, "admin");
    await recordSsoConnectionTest({
      c,
      organizationId: row.organization.id,
      actorUserId: user.id,
      actorIdentityId: access!.identity.id,
      connectionId,
      email,
      type: "oidc",
    });
    return c.redirect(`${businessOrigin()}?sso_test=success`, 302);
  }

  const displayName = typeof claims.name === "string" ? claims.name : null;
  await completeEnterpriseSsoLogin({ c, organization: row.organization, connection: row.connection, email, displayName });
  return c.redirect(stored.returnTo || `${businessOrigin()}?sso=success`, 302);
});

app.use("/organizations/*", requireAuth);
app.use("/organizations/*", requireWritableForMutation);

app.post("/organizations/:organizationId/domains", zValidator("json", z.object({
  domain: domainSchema,
  signedAction: signedActionSchema,
})), async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");
  const { domain, signedAction } = c.req.valid("json");
  const access = await requireBusinessAccess(user.id, organizationId, "admin");
  if (!access || !hasBusinessScope(access.member, "manage_sso")) return c.json({ error: "Organization not found" }, 404);
  const ssoError = await rejectWithoutRequiredSso(c, access);
  if (ssoError) return ssoError;
  const authorityError = rejectWithoutSigningAuthority(c, access.member);
  if (authorityError) return authorityError;

  const auditDetails = { domain };
  const signatureError = await requireSignedAction(c, access.identity.id, "domain_verification.created", auditDetails, signedAction?.signature);
  if (signatureError) return signatureError;

  const token = verificationToken();
  const [created] = await db.insert(organizationDomainVerifications).values({
    organizationId,
    domain,
    token,
    status: "pending",
  }).onConflictDoUpdate({
    target: [organizationDomainVerifications.organizationId, organizationDomainVerifications.domain],
    set: { token, status: "pending", updatedAt: new Date(), verifiedAt: null },
  }).returning();

  await writeBusinessAuditEvent({
    organizationId,
    actorUserId: user.id,
    actorIdentityId: access.identity.id,
    action: "domain_verification.created",
    details: auditDetails,
    signature: signedAction?.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });

  return c.json({ domain: created }, 201);
});

app.post("/organizations/:organizationId/domains/:domainId/verify", zValidator("json", z.object({
  signedAction: signedActionSchema,
})), async (c) => {
  const user = c.get("user")!;
  const { organizationId, domainId } = c.req.param();
  const { signedAction } = c.req.valid("json");
  const access = await requireBusinessAccess(user.id, organizationId, "admin");
  if (!access || !hasBusinessScope(access.member, "manage_sso")) return c.json({ error: "Organization not found" }, 404);
  const ssoError = await rejectWithoutRequiredSso(c, access);
  if (ssoError) return ssoError;
  const authorityError = rejectWithoutSigningAuthority(c, access.member);
  if (authorityError) return authorityError;

  const [domain] = await db.select().from(organizationDomainVerifications)
    .where(and(eq(organizationDomainVerifications.id, domainId), eq(organizationDomainVerifications.organizationId, organizationId)))
    .limit(1);
  if (!domain) return c.json({ error: "Domain verification not found" }, 404);
  const auditDetails = { domain: domain.domain };
  const signatureError = await requireSignedAction(c, access.identity.id, "domain_verification.verified", auditDetails, signedAction?.signature);
  if (signatureError) return signatureError;
  if (!(await verifyDnsTxt(domain.domain, domain.token))) return c.json({ error: "DNS TXT record not found" }, 409);

  await db.update(organizationDomainVerifications).set({ status: "verified", verifiedAt: new Date(), updatedAt: new Date() }).where(eq(organizationDomainVerifications.id, domain.id));
  const verifiedDomains = Array.from(new Set([...(access.organization.verifiedDomains || []), domain.domain]));
  await db.update(organizations).set({ verifiedDomains, updatedAt: new Date() }).where(eq(organizations.id, organizationId));
  await writeBusinessAuditEvent({
    organizationId,
    actorUserId: user.id,
    actorIdentityId: access.identity.id,
    action: "domain_verification.verified",
    details: auditDetails,
    signature: signedAction?.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });

  return c.json({ success: true, verifiedDomains });
});

app.post("/organizations/:organizationId/sso-connections", zValidator("json", z.object({
  type: z.enum(["saml", "oidc"]),
  provider: z.string().min(2).max(40).default("generic"),
  name: z.string().min(2).max(80),
  domain: domainSchema.optional(),
  metadataUrl: z.string().url().optional(),
  entityId: z.string().max(400).optional(),
  ssoUrl: z.string().url().optional(),
  x509Certificate: z.string().max(12000).optional(),
  issuer: z.string().url().optional(),
  authorizationEndpoint: z.string().url().optional(),
  tokenEndpoint: z.string().url().optional(),
  jwksUri: z.string().url().optional(),
  clientId: z.string().max(200).optional(),
  clientSecret: z.string().max(4000).optional(),
  encryptedClientSecret: z.string().max(4000).optional(),
  signedAction: signedActionSchema,
})), async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");
  const body = c.req.valid("json");
  const access = await requireBusinessAccess(user.id, organizationId, "admin");
  if (!access || !hasBusinessScope(access.member, "manage_sso")) return c.json({ error: "Organization not found" }, 404);
  const ssoError = await rejectWithoutRequiredSso(c, access);
  if (ssoError) return ssoError;
  const authorityError = rejectWithoutSigningAuthority(c, access.member);
  if (authorityError) return authorityError;
  if (body.domain && !(access.organization.verifiedDomains || []).includes(body.domain)) {
    return c.json({ error: "Verify this domain before attaching SSO" }, 400);
  }
  if (body.type === "oidc" && (!body.issuer || !body.clientId)) {
    return c.json({ error: "OIDC setup requires an issuer and client ID" }, 400);
  }

  const auditDetails = { type: body.type, provider: body.provider, name: body.name, domain: body.domain };
  const signatureError = await requireSignedAction(c, access.identity.id, "sso_connection.created", auditDetails, body.signedAction?.signature);
  if (signatureError) return signatureError;
  const encryptedClientSecret = body.clientSecret
    ? await encryptSsoClientSecret(body.clientSecret)
    : body.encryptedClientSecret;

  const [connection] = await db.insert(organizationSsoConnections).values({
    organizationId,
    type: body.type,
    provider: body.provider,
    name: body.name,
    domain: body.domain,
    metadataUrl: body.metadataUrl,
    entityId: body.entityId,
    ssoUrl: body.ssoUrl,
    x509Certificate: body.x509Certificate,
    issuer: body.issuer,
    authorizationEndpoint: body.authorizationEndpoint,
    tokenEndpoint: body.tokenEndpoint,
    jwksUri: body.jwksUri,
    clientId: body.clientId,
    encryptedClientSecret,
    status: "draft",
    keyAccessMode: "ave_identity_keys",
  }).returning();

  await writeBusinessAuditEvent({
    organizationId,
    actorUserId: user.id,
    actorIdentityId: access.identity.id,
    action: "sso_connection.created",
    details: auditDetails,
    signature: body.signedAction?.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });

  return c.json({
    connection: serializeSsoConnection(connection),
    saml: connection.type === "saml" ? buildSamlServiceProviderUrls(connection.id) : null,
  }, 201);
});

app.patch("/organizations/:organizationId/sso-connections/:connectionId", zValidator("json", z.object({
  status: z.enum(["draft", "active", "disabled"]).optional(),
  name: z.string().min(2).max(80).optional(),
  provider: z.string().min(2).max(40).optional(),
  domain: domainSchema.optional(),
  entityId: z.string().max(400).optional(),
  ssoUrl: z.string().url().optional(),
  x509Certificate: z.string().max(12000).optional(),
  issuer: z.string().url().optional(),
  authorizationEndpoint: z.string().url().optional(),
  tokenEndpoint: z.string().url().optional(),
  jwksUri: z.string().url().optional(),
  clientId: z.string().max(200).optional(),
  clientSecret: z.string().max(4000).optional(),
  encryptedClientSecret: z.string().max(4000).optional(),
  signedAction: signedActionSchema,
})), async (c) => {
  const user = c.get("user")!;
  const { organizationId, connectionId } = c.req.param();
  const body = c.req.valid("json");
  const access = await requireBusinessAccess(user.id, organizationId, "admin");
  if (!access || !hasBusinessScope(access.member, "manage_sso")) return c.json({ error: "Organization not found" }, 404);
  const ssoError = await rejectWithoutRequiredSso(c, access);
  if (ssoError) return ssoError;
  const authorityError = rejectWithoutSigningAuthority(c, access.member);
  if (authorityError) return authorityError;

  const [connection] = await db.select().from(organizationSsoConnections)
    .where(and(eq(organizationSsoConnections.id, connectionId), eq(organizationSsoConnections.organizationId, organizationId)))
    .limit(1);
  if (!connection) return c.json({ error: "SSO connection not found" }, 404);
  if (body.status === "active") return c.json({ error: "Run a successful SSO test before activating this connection" }, 409);
  if (body.domain && !(access.organization.verifiedDomains || []).includes(body.domain)) {
    return c.json({ error: "Verify this domain before attaching SSO" }, 400);
  }
  const auditDetails = {
    connectionId,
    status: body.status,
    name: body.name,
    domain: body.domain,
    certificateChanged: body.x509Certificate !== undefined && body.x509Certificate !== connection.x509Certificate,
  };
  const signatureError = await requireSignedAction(c, access.identity.id, "sso_connection.updated", auditDetails, body.signedAction?.signature);
  if (signatureError) return signatureError;
  const encryptedClientSecret = body.clientSecret
    ? await encryptSsoClientSecret(body.clientSecret)
    : body.encryptedClientSecret;

  const [updated] = await db.update(organizationSsoConnections).set({
    status: body.status ?? connection.status,
    name: body.name ?? connection.name,
    provider: body.provider ?? connection.provider,
    domain: body.domain ?? connection.domain,
    entityId: body.entityId ?? connection.entityId,
    ssoUrl: body.ssoUrl ?? connection.ssoUrl,
    x509Certificate: body.x509Certificate ?? connection.x509Certificate,
    issuer: body.issuer ?? connection.issuer,
    authorizationEndpoint: body.authorizationEndpoint ?? connection.authorizationEndpoint,
    tokenEndpoint: body.tokenEndpoint ?? connection.tokenEndpoint,
    jwksUri: body.jwksUri ?? connection.jwksUri,
    clientId: body.clientId ?? connection.clientId,
    encryptedClientSecret: encryptedClientSecret ?? connection.encryptedClientSecret,
    updatedAt: new Date(),
  }).where(eq(organizationSsoConnections.id, connectionId)).returning();

  await writeBusinessAuditEvent({
    organizationId,
    actorUserId: user.id,
    actorIdentityId: access.identity.id,
    action: "sso_connection.updated",
    details: auditDetails,
    signature: body.signedAction?.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });
  if (auditDetails.certificateChanged) {
    await writeBusinessAuditEvent({
      organizationId,
      actorUserId: user.id,
      actorIdentityId: access.identity.id,
      action: "sso_connection.certificate_changed",
      details: { connectionId },
      signature: body.signedAction?.signature,
      ipAddress: clientIp(c),
      userAgent: userAgent(c),
    });
  }

  return c.json({ connection: serializeSsoConnection(updated) });
});

export default app;
