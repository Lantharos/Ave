import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  identities,
  organizationIdentityMembers,
  organizationKeyGrants,
  organizationSsoConnections,
  organizations,
} from "../db";
import { requireAuth, requireWritableForMutation } from "../middleware/auth";
import {
  businessScopes,
  canManageRole,
  createBusinessOrganization,
  hasBusinessScope,
  requireBusinessAccess,
  buildAuditPayload,
  scopesForRole,
  shouldRequireEnterpriseSsoForBusinessAccess,
  verifySignedBusinessAction,
  type BusinessRole,
} from "../lib/business";
import {
  clientIp,
  getOrganizationBundle,
  userAgent,
} from "../lib/business-route-utils";
import { getRequiredEnterpriseSsoForOrganization } from "../lib/enterprise-sso-policy";
import { recordBusinessAuditEvent } from "../lib/background-events";
import businessKeyRoutes from "./business-keys";
import businessSsoRoutes from "./business-sso";

const app = new Hono();

const roleSchema = z.enum(["owner", "admin", "signer", "member", "viewer"]);
const scopeSchema = z.enum(businessScopes as [string, ...string[]]);
const signedActionSchema = z.object({ signature: z.string().min(1).max(2000) }).optional();

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

app.route("/", businessSsoRoutes);
app.route("/", businessKeyRoutes);

app.use("*", requireAuth);
app.use("*", requireWritableForMutation);

app.get("/organizations/bootstrap", async (c) => {
  const user = c.get("user")!;
  const userIdentities = await db.select().from(identities).where(eq(identities.userId, user.id));
  const identityIds = userIdentities.map((identity) => identity.id);
  const memberships = identityIds.length
    ? await db
        .select({ member: organizationIdentityMembers, organization: organizations, identity: identities })
        .from(organizationIdentityMembers)
        .innerJoin(organizations, eq(organizations.id, organizationIdentityMembers.organizationId))
        .innerJoin(identities, eq(identities.id, organizationIdentityMembers.identityId))
        .where(and(inArray(organizationIdentityMembers.identityId, identityIds), eq(organizationIdentityMembers.status, "active")))
    : [];

  const seen = new Map<string, (typeof memberships)[number]>();
  for (const membership of memberships) {
    if (!seen.has(membership.organization.id)) seen.set(membership.organization.id, membership);
  }

  return c.json({
    identities: userIdentities.map((identity) => ({
      id: identity.id,
      handle: identity.handle,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      isPrimary: identity.isPrimary,
    })),
    organizations: [...seen.values()].map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      logoUrl: membership.organization.logoUrl,
      verifiedDomains: membership.organization.verifiedDomains || [],
      ssoRequired: membership.organization.ssoRequired,
      role: membership.member.role,
      scopes: scopesForRole(membership.member.role as BusinessRole, membership.member.scopes as string[] | null),
      actingIdentityId: membership.identity.id,
      actingHandle: membership.identity.handle,
    })),
  });
});

app.post("/organizations", zValidator("json", z.object({
  name: z.string().min(2).max(80),
  ownerIdentityId: z.string().uuid(),
  signedAction: signedActionSchema,
})), async (c) => {
  const user = c.get("user")!;
  const body = c.req.valid("json");
  const [ownerIdentity] = await db.select().from(identities)
    .where(and(eq(identities.id, body.ownerIdentityId), eq(identities.userId, user.id)))
    .limit(1);
  if (!ownerIdentity) return c.json({ error: "Owner identity not found" }, 404);

  const auditDetails = { name: body.name.trim(), ownerIdentityId: ownerIdentity.id };
  const signatureError = await requireSignedAction(c, ownerIdentity.id, "organization.created", auditDetails, body.signedAction?.signature);
  if (signatureError) return signatureError;

  const created = await createBusinessOrganization(user.id, body.name.trim(), body.ownerIdentityId);
  if (!created) return c.json({ error: "Owner identity not found" }, 404);

  recordBusinessAuditEvent(c, {
    organizationId: created.organization.id,
    actorUserId: user.id,
    actorIdentityId: created.identity.id,
    action: "organization.created",
    details: auditDetails,
    signature: body.signedAction?.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });

  return c.json({
    organization: {
      id: created.organization.id,
      name: created.organization.name,
      slug: created.organization.slug,
      logoUrl: created.organization.logoUrl,
      verifiedDomains: created.organization.verifiedDomains || [],
      ssoRequired: created.organization.ssoRequired,
      role: created.member.role,
      actingIdentityId: created.identity.id,
    },
  }, 201);
});

app.get("/organizations/:organizationId", async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");
  const access = await requireBusinessAccess(user.id, organizationId, "viewer");
  if (!access) return c.json({ error: "Organization not found" }, 404);
  const ssoError = await rejectWithoutRequiredSso(c, access);
  if (ssoError) return ssoError;

  return c.json({
    organization: {
      id: access.organization.id,
      name: access.organization.name,
      slug: access.organization.slug,
      logoUrl: access.organization.logoUrl,
      verifiedDomains: access.organization.verifiedDomains || [],
      ssoRequired: access.organization.ssoRequired,
      role: access.member.role,
      scopes: scopesForRole(access.member.role as BusinessRole, access.member.scopes as string[] | null),
      actingIdentityId: access.identity.id,
      actingHandle: access.identity.handle,
    },
    ...(await getOrganizationBundle(organizationId, { includeAudit: c.req.query("includeAudit") === "true" })),
  });
});

app.patch("/organizations/:organizationId", zValidator("json", z.object({
  name: z.string().min(2).max(80).optional(),
  ssoRequired: z.boolean().optional(),
  signedAction: signedActionSchema,
})), async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");
  const body = c.req.valid("json");
  const access = await requireBusinessAccess(user.id, organizationId, "admin");
  if (!access || !hasBusinessScope(access.member, "manage_org")) return c.json({ error: "Organization not found" }, 404);
  const ssoError = await rejectWithoutRequiredSso(c, access);
  if (ssoError) return ssoError;
  const authorityError = rejectWithoutSigningAuthority(c, access.member);
  if (authorityError) return authorityError;

  const auditDetails = { name: body.name, ssoRequired: body.ssoRequired };
  const signatureError = await requireSignedAction(c, access.identity.id, "organization.updated", auditDetails, body.signedAction?.signature);
  if (signatureError) return signatureError;

  if (body.ssoRequired === true && !access.organization.ssoRequired) {
    const [activeConnection] = await db.select({ id: organizationSsoConnections.id }).from(organizationSsoConnections)
      .where(and(
        eq(organizationSsoConnections.organizationId, organizationId),
        eq(organizationSsoConnections.status, "active"),
      ))
      .limit(1);
    if (!activeConnection) {
      return c.json({ error: "SSO cannot be required until an SSO connection has passed runtime validation" }, 409);
    }
  }

  const [updated] = await db.update(organizations)
    .set({
      name: body.name ?? access.organization.name,
      ssoRequired: body.ssoRequired ?? access.organization.ssoRequired,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning();

  recordBusinessAuditEvent(c, {
    organizationId,
    actorUserId: user.id,
    actorIdentityId: access.identity.id,
    action: "organization.updated",
    details: auditDetails,
    signature: body.signedAction?.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });

  return c.json({ organization: updated });
});

app.post("/organizations/:organizationId/identities", zValidator("json", z.object({
  handle: z.string().min(3).max(32).transform((value) => value.trim().replace(/^@/, "").toLowerCase()),
  role: roleSchema.default("member"),
  scopes: z.array(scopeSchema).optional(),
  signingAuthority: z.boolean().optional(),
  signedAction: signedActionSchema,
})), async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");
  const body = c.req.valid("json");
  const access = await requireBusinessAccess(user.id, organizationId, "admin");
  if (!access || !hasBusinessScope(access.member, "manage_identities")) return c.json({ error: "Organization not found" }, 404);
  const ssoError = await rejectWithoutRequiredSso(c, access);
  if (ssoError) return ssoError;
  const authorityError = rejectWithoutSigningAuthority(c, access.member);
  if (authorityError) return authorityError;
  if (!canManageRole(access.member.role as BusinessRole, body.role)) return c.json({ error: "Cannot assign that role" }, 403);

  const [targetIdentity] = await db.select().from(identities).where(eq(identities.handle, body.handle)).limit(1);
  if (!targetIdentity) return c.json({ error: "Identity not found" }, 404);
  const auditDetails = { handle: targetIdentity.handle, role: body.role, scopes: scopesForRole(body.role, body.scopes) };
  const signatureError = await requireSignedAction(c, access.identity.id, "identity.added", auditDetails, body.signedAction?.signature);
  if (signatureError) return signatureError;

  const [created] = await db.insert(organizationIdentityMembers).values({
    organizationId,
    identityId: targetIdentity.id,
    addedByUserId: user.id,
    addedByIdentityId: access.identity.id,
    role: body.role,
    scopes: scopesForRole(body.role, body.scopes),
    signingAuthority: body.signingAuthority ?? (body.role === "owner" || body.role === "admin" || body.role === "signer"),
    status: "active",
  }).returning();

  recordBusinessAuditEvent(c, {
    organizationId,
    actorUserId: user.id,
    actorIdentityId: access.identity.id,
    targetIdentityId: targetIdentity.id,
    action: "identity.added",
    details: auditDetails,
    signature: body.signedAction?.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });

  return c.json({ member: { id: created.id, identityId: targetIdentity.id, role: created.role } }, 201);
});

app.patch("/organizations/:organizationId/identities/:memberId", zValidator("json", z.object({
  role: roleSchema.optional(),
  scopes: z.array(scopeSchema).optional(),
  signingAuthority: z.boolean().optional(),
  signedAction: signedActionSchema,
})), async (c) => {
  const user = c.get("user")!;
  const { organizationId, memberId } = c.req.param();
  const body = c.req.valid("json");
  const access = await requireBusinessAccess(user.id, organizationId, "admin");
  if (!access || !hasBusinessScope(access.member, "manage_identities")) return c.json({ error: "Organization not found" }, 404);
  const ssoError = await rejectWithoutRequiredSso(c, access);
  if (ssoError) return ssoError;
  const authorityError = rejectWithoutSigningAuthority(c, access.member);
  if (authorityError) return authorityError;

  const [target] = await db.select().from(organizationIdentityMembers)
    .where(and(eq(organizationIdentityMembers.id, memberId), eq(organizationIdentityMembers.organizationId, organizationId)))
    .limit(1);
  if (!target) return c.json({ error: "Member not found" }, 404);
  const nextRole = (body.role || target.role) as BusinessRole;
  if (!canManageRole(access.member.role as BusinessRole, target.role as BusinessRole) || !canManageRole(access.member.role as BusinessRole, nextRole)) {
    return c.json({ error: "Cannot change that member" }, 403);
  }
  const auditDetails = { memberId, role: nextRole, scopes: scopesForRole(nextRole, body.scopes ?? (target.scopes as string[] | null)) };
  const signatureError = await requireSignedAction(c, access.identity.id, "identity.updated", auditDetails, body.signedAction?.signature);
  if (signatureError) return signatureError;

  const [updated] = await db.update(organizationIdentityMembers).set({
    role: nextRole,
    scopes: scopesForRole(nextRole, body.scopes ?? (target.scopes as string[] | null)),
    signingAuthority: body.signingAuthority ?? target.signingAuthority,
    updatedAt: new Date(),
  }).where(eq(organizationIdentityMembers.id, memberId)).returning();

  recordBusinessAuditEvent(c, {
    organizationId,
    actorUserId: user.id,
    actorIdentityId: access.identity.id,
    targetIdentityId: target.identityId,
    action: "identity.updated",
    details: auditDetails,
    signature: body.signedAction?.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });

  return c.json({ member: updated });
});

app.delete("/organizations/:organizationId/identities/:memberId", zValidator("json", z.object({
  signedAction: signedActionSchema,
})), async (c) => {
  const user = c.get("user")!;
  const { organizationId, memberId } = c.req.param();
  const body = c.req.valid("json");
  const access = await requireBusinessAccess(user.id, organizationId, "admin");
  if (!access || !hasBusinessScope(access.member, "manage_identities")) return c.json({ error: "Organization not found" }, 404);
  const ssoError = await rejectWithoutRequiredSso(c, access);
  if (ssoError) return ssoError;
  const authorityError = rejectWithoutSigningAuthority(c, access.member);
  if (authorityError) return authorityError;

  const [target] = await db.select().from(organizationIdentityMembers)
    .where(and(eq(organizationIdentityMembers.id, memberId), eq(organizationIdentityMembers.organizationId, organizationId)))
    .limit(1);
  if (!target) return c.json({ error: "Member not found" }, 404);
  if (!canManageRole(access.member.role as BusinessRole, target.role as BusinessRole)) return c.json({ error: "Cannot remove that member" }, 403);
  const auditDetails = { memberId };
  const signatureError = await requireSignedAction(c, access.identity.id, "identity.removed", auditDetails, body.signedAction?.signature);
  if (signatureError) return signatureError;

  await db.update(organizationIdentityMembers).set({ status: "removed", updatedAt: new Date() }).where(eq(organizationIdentityMembers.id, memberId));
  await db.update(organizationKeyGrants)
    .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(organizationKeyGrants.organizationId, organizationId),
      eq(organizationKeyGrants.identityId, target.identityId),
      eq(organizationKeyGrants.status, "active"),
    ));
  recordBusinessAuditEvent(c, {
    organizationId,
    actorUserId: user.id,
    actorIdentityId: access.identity.id,
    targetIdentityId: target.identityId,
    action: "identity.removed",
    details: auditDetails,
    signature: body.signedAction?.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
    severity: "warning",
  });
  return c.json({ success: true });
});

export default app;
