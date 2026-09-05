import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, identities, organizationIdentityMembers } from "../db";
import { businessRoleForOrganizationRole, mapBusinessRoleToOrganizationRole, requireOrganizationAccess, signingAuthorityForOrganizationRole } from "../lib/dev-portal";
import { canManageRole, hasBusinessScope, scopesForRole, type BusinessRole } from "../lib/business";
import { requireSignedAction } from "../lib/business-route-guards";
import { recordBusinessAuditEvent } from "../lib/background-events";
import { clientIp, userAgent } from "../lib/business-route-utils";

const app = new Hono();
const roleSchema = z.enum(["owner", "admin", "viewer"]);
const signedActionSchema = z.object({ signature: z.string().min(1).max(2000) });

app.post("/:organizationId/invites", zValidator("json", z.object({
  email: z.string().email(),
  role: roleSchema.default("admin"),
  signedAction: signedActionSchema,
})), async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");
  const payload = c.req.valid("json");

  const membership = await requireOrganizationAccess(user, organizationId, "admin");
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  if (!hasBusinessScope(membership.member, "manage_identities")) return c.json({ error: "Member management permission required" }, 403);
  const role = businessRoleForOrganizationRole(payload.role);
  if (!canManageRole(membership.member.role as BusinessRole, role)) return c.json({ error: "Cannot assign that role" }, 403);
  const details = { organizationId, email: payload.email.trim().toLowerCase(), role: payload.role };
  const signatureError = await requireSignedAction(c, membership.identity.id, "workspace.member.added", details, payload.signedAction.signature);
  if (signatureError) return signatureError;

  if (payload.role === "owner") {
    return c.json({ error: "Workspace owner cannot be reassigned" }, 400);
  }

  const [targetIdentity] = await db
    .select()
    .from(identities)
    .where(eq(identities.email, details.email))
    .limit(1);

  if (!targetIdentity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  const [existingMember] = await db
    .select()
    .from(organizationIdentityMembers)
    .where(and(eq(organizationIdentityMembers.organizationId, organizationId), eq(organizationIdentityMembers.identityId, targetIdentity.id)))
    .limit(1);

  if (existingMember?.status === "active") {
    return c.json({ error: "Member already exists" }, 409);
  }

  if (existingMember && !canManageRole(membership.member.role as BusinessRole, existingMember.role as BusinessRole)) {
    return c.json({ error: "Cannot change that member" }, 403);
  }

  const [created] = existingMember
    ? await db
      .update(organizationIdentityMembers)
      .set({
        role,
        scopes: scopesForRole(role),
        signingAuthority: signingAuthorityForOrganizationRole(payload.role),
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(organizationIdentityMembers.id, existingMember.id))
      .returning()
    : await db
      .insert(organizationIdentityMembers)
      .values({
      organizationId,
      identityId: targetIdentity.id,
      addedByUserId: user.id,
      addedByIdentityId: membership.identity.id,
      role,
      scopes: scopesForRole(role),
      signingAuthority: signingAuthorityForOrganizationRole(payload.role),
      status: "active",
    })
      .returning();

  recordBusinessAuditEvent(c, {
    organizationId,
    actorUserId: user.id,
    actorIdentityId: membership.identity.id,
    targetIdentityId: targetIdentity.id,
    action: "workspace.member.added",
    details,
    signature: payload.signedAction.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });
  return c.json({
    member: {
      id: created.id,
      userId: targetIdentity.userId,
      name: targetIdentity.displayName || targetIdentity.handle,
      email: targetIdentity.email,
      avatarUrl: targetIdentity.avatarUrl,
      role: mapBusinessRoleToOrganizationRole(created.role),
      status: "active",
      joinedAt: created.createdAt,
    },
  }, 201);
});

app.patch("/:organizationId/members/:memberId", zValidator("json", z.object({
  role: roleSchema,
  signedAction: signedActionSchema,
})), async (c) => {
  const user = c.get("user")!;
  const { organizationId, memberId } = c.req.param();
  const payload = c.req.valid("json");

  const membership = await requireOrganizationAccess(user, organizationId, "admin");
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const [target] = await db
    .select({ member: organizationIdentityMembers, identity: identities })
    .from(organizationIdentityMembers)
    .innerJoin(identities, eq(identities.id, organizationIdentityMembers.identityId))
    .where(and(eq(organizationIdentityMembers.id, memberId), eq(organizationIdentityMembers.organizationId, organizationId)))
    .limit(1);

  if (!target) {
    return c.json({ error: "Member not found" }, 404);
  }

  if (target.member.status !== "active") {
    return c.json({ error: "Cannot change role for an inactive member" }, 400);
  }

  if (target.identity.userId === membership.organization.ownerUserId && payload.role !== "owner") {
    return c.json({ error: "Cannot demote the workspace owner" }, 400);
  }

  if (payload.role === "owner" && target.identity.userId !== membership.organization.ownerUserId) {
    return c.json({ error: "Workspace owner cannot be reassigned" }, 400);
  }

  if (!hasBusinessScope(membership.member, "manage_identities")) return c.json({ error: "Member management permission required" }, 403);
  const role = businessRoleForOrganizationRole(payload.role);
  if (!canManageRole(membership.member.role as BusinessRole, target.member.role as BusinessRole)
    || !canManageRole(membership.member.role as BusinessRole, role)) {
    return c.json({ error: "Cannot change that member" }, 403);
  }
  const details = { organizationId, memberId, role: payload.role };
  const signatureError = await requireSignedAction(c, membership.identity.id, "workspace.member.updated", details, payload.signedAction.signature);
  if (signatureError) return signatureError;
  const [updated] = await db
    .update(organizationIdentityMembers)
    .set({
      role,
      scopes: scopesForRole(role),
      signingAuthority: signingAuthorityForOrganizationRole(payload.role),
      updatedAt: new Date(),
    })
    .where(eq(organizationIdentityMembers.id, memberId))
    .returning();

  recordBusinessAuditEvent(c, {
    organizationId,
    actorUserId: user.id,
    actorIdentityId: membership.identity.id,
    targetIdentityId: target.identity.id,
    action: "workspace.member.updated",
    details,
    signature: payload.signedAction.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });
  return c.json({
    member: {
      id: updated.id,
      role: mapBusinessRoleToOrganizationRole(updated.role),
      status: updated.status,
    },
  });
});

export default app;
