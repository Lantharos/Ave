import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db, organizations, organizationSsoConnections } from "../db";
import { hasBusinessScope, requireBusinessAccess, shouldRequireEnterpriseSsoForBusinessAccess, writeBusinessAuditEvent } from "../lib/business";
import { buildSamlRedirectUrl, validateSamlResponse } from "../lib/business-saml";
import { completeEnterpriseSsoLogin, recordSsoConnectionTest } from "../lib/business-sso-login";
import { clientIp, userAgent } from "../lib/business-route-utils";
import { deleteChallenge, getChallenge, setChallenge } from "../lib/challenge-store";
import { randomBase64Url } from "../lib/business-oidc";
import { buildSamlServiceProviderMetadata } from "../lib/sso-metadata";
import { businessOrigin, enterpriseSsoReturnTo } from "../lib/enterprise-sso-return";
import { getRequiredEnterpriseSsoForOrganization } from "../lib/enterprise-sso-policy";

const app = new Hono();

type SamlSsoState = {
  connectionId: string;
  mode: "login" | "test";
  requestId?: string;
  returnTo?: string;
};

async function rejectSsoTestAccess(c: any, organizationId: string) {
  const user = c.get("user");
  if (!user) return c.text("Sign in to Ave before testing SSO", 401);
  if (user.isReadOnly) return c.text("Demo account is read-only", 403);
  const access = await requireBusinessAccess(user.id, organizationId, "admin");
  if (!access || !hasBusinessScope(access.member, "manage_sso")) return c.text("Organization not found", 404);
  if (!shouldRequireEnterpriseSsoForBusinessAccess(user, access)) return null;
  const policy = await getRequiredEnterpriseSsoForOrganization(access.organization);
  return c.json({
    error: "enterprise_sso_required",
    loginUrl: policy?.loginUrl,
    organization: { id: access.organization.id, name: access.organization.name },
  }, 403);
}

app.get("/sso/saml/:connectionId/metadata.xml", async (c) => {
  const connectionId = c.req.param("connectionId");
  const [connection] = await db
    .select()
    .from(organizationSsoConnections)
    .where(and(eq(organizationSsoConnections.id, connectionId), eq(organizationSsoConnections.type, "saml")))
    .limit(1);

  if (!connection) return c.text("Not found", 404);
  c.header("Content-Type", "application/samlmetadata+xml; charset=utf-8");
  c.header("Cache-Control", "public, max-age=300");
  return c.body(buildSamlServiceProviderMetadata(connection));
});

app.get("/sso/saml/:connectionId/start", async (c) => {
  const connectionId = c.req.param("connectionId");
  const mode = c.req.query("mode") === "test" ? "test" : "login";
  const returnTo = enterpriseSsoReturnTo(c.req.query("return_to"));
  const [row] = await db
    .select({ connection: organizationSsoConnections, organization: organizations })
    .from(organizationSsoConnections)
    .innerJoin(organizations, eq(organizations.id, organizationSsoConnections.organizationId))
    .where(and(eq(organizationSsoConnections.id, connectionId), eq(organizationSsoConnections.type, "saml")))
    .limit(1);

  if (!row) return c.text("SAML connection not found", 404);
  if (mode === "login" && row.connection.status !== "active") return c.text("SAML connection is not active", 409);
  if (mode === "test") {
    const accessError = await rejectSsoTestAccess(c, row.organization.id);
    if (accessError) return accessError;
  }

  const state = randomBase64Url();
  const { url, requestId } = buildSamlRedirectUrl(row.connection, state);
  await setChallenge<SamlSsoState>("business-saml", state, { connectionId, mode, requestId, returnTo }, 10 * 60 * 1000);
  return c.redirect(url, 302);
});

app.post("/sso/saml/:connectionId/acs", async (c) => {
  const connectionId = c.req.param("connectionId");
  const body = await c.req.parseBody();
  const encodedResponse = typeof body.SAMLResponse === "string" ? body.SAMLResponse : "";
  const relayState = typeof body.RelayState === "string" ? body.RelayState : "";
  if (!encodedResponse) return c.text("Missing SAMLResponse", 400);

  const stored = relayState ? await getChallenge<SamlSsoState>("business-saml", relayState) : null;
  if (relayState) await deleteChallenge("business-saml", relayState);
  if (stored && stored.connectionId !== connectionId) return c.text("SAML login expired", 400);

  const [row] = await db
    .select({ connection: organizationSsoConnections, organization: organizations })
    .from(organizationSsoConnections)
    .innerJoin(organizations, eq(organizations.id, organizationSsoConnections.organizationId))
    .where(and(eq(organizationSsoConnections.id, connectionId), eq(organizationSsoConnections.type, "saml")))
    .limit(1);
  if (!row) return c.text("SAML connection not found", 404);

  let assertion;
  try {
    assertion = validateSamlResponse({ encodedResponse, connection: row.connection, expectedRequestId: stored?.requestId });
  } catch (err) {
    await writeBusinessAuditEvent({
      organizationId: row.organization.id,
      action: "sso.login_failed",
      details: { connectionId, reason: err instanceof Error ? err.message : "SAML validation failed" },
      ipAddress: clientIp(c),
      userAgent: userAgent(c),
    });
    return c.text("SAML response validation failed", 400);
  }

  const emailDomain = assertion.email.split("@").pop() || "";
  if (row.connection.domain && emailDomain !== row.connection.domain) return c.text("SAML email domain is not allowed for this organization", 403);

  if (stored?.mode === "test" || (!stored && row.connection.status !== "active")) {
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
      email: assertion.email,
      type: "saml",
    });
    return c.redirect(`${businessOrigin()}?sso_test=success`, 302);
  }

  if (row.connection.status !== "active") return c.text("SAML connection is not active", 409);
  await completeEnterpriseSsoLogin({
    c,
    organization: row.organization,
    connection: row.connection,
    email: assertion.email,
    displayName: assertion.displayName,
  });
  return c.redirect(stored?.returnTo || `${businessOrigin()}?sso=success`, 302);
});

export default app;
