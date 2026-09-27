import { recordActivityLog } from "../../lib/platform/background-events";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, identities, developerMembers } from "../../db";
import { canManageRole, requireOrganizationAccess } from "../../lib/developer/dev-portal";

const app = new Hono();
const roleSchema = z.enum(["owner", "admin", "viewer"]);

app.post("/:organizationId/invites", zValidator("json", z.object({
  email: z.string().email(),
  role: roleSchema.default("admin"),
})), async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");
  const payload = c.req.valid("json");

  const membership = await requireOrganizationAccess(user, organizationId, "admin");
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const role = payload.role;
  if (!canManageRole(membership.member.role, role)) return c.json({ error: "Cannot assign that role" }, 403);
  const details = { organizationId, email: payload.email.trim().toLowerCase(), role: payload.role };

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
    .from(developerMembers)
    .where(and(eq(developerMembers.organizationId, organizationId), eq(developerMembers.identityId, targetIdentity.id)))
    .limit(1);

  if (existingMember?.status === "active") {
    return c.json({ error: "Member already exists" }, 409);
  }

  if (existingMember && !canManageRole(membership.member.role, existingMember.role)) {
    return c.json({ error: "Cannot change that member" }, 403);
  }

  const [created] = existingMember
    ? await db
      .update(developerMembers)
      .set({
        role,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(developerMembers.id, existingMember.id))
      .returning()
    : await db
      .insert(developerMembers)
      .values({
      organizationId,
      identityId: targetIdentity.id,
      role,
      status: "active",
    })
      .returning();

  recordActivityLog(c, {
    userId: user.id,
    action: "workspace.member.added",
    details,
    deviceId: user.deviceId,
    ipAddress: c.req.header("cf-connecting-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({
    member: {
      id: created.id,
      userId: targetIdentity.userId,
      name: targetIdentity.displayName || targetIdentity.handle,
      email: targetIdentity.email,
      avatarUrl: targetIdentity.avatarUrl,
      role: created.role,
      status: "active",
      joinedAt: created.createdAt,
    },
  }, 201);
});

app.patch("/:organizationId/members/:memberId", zValidator("json", z.object({
  role: roleSchema,
})), async (c) => {
  const user = c.get("user")!;
  const { organizationId, memberId } = c.req.param();
  const payload = c.req.valid("json");

  const membership = await requireOrganizationAccess(user, organizationId, "admin");
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const [target] = await db
    .select({ member: developerMembers, identity: identities })
    .from(developerMembers)
    .innerJoin(identities, eq(identities.id, developerMembers.identityId))
    .where(and(eq(developerMembers.id, memberId), eq(developerMembers.organizationId, organizationId)))
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

  const role = payload.role;
  if (!canManageRole(membership.member.role, target.member.role)
    || !canManageRole(membership.member.role, role)) {
    return c.json({ error: "Cannot change that member" }, 403);
  }
  const details = { organizationId, memberId, role: payload.role };
  const [updated] = await db
    .update(developerMembers)
    .set({
      role,
      updatedAt: new Date(),
    })
    .where(eq(developerMembers.id, memberId))
    .returning();

  recordActivityLog(c, {
    userId: user.id,
    action: "workspace.member.updated",
    details,
    deviceId: user.deviceId,
    ipAddress: c.req.header("cf-connecting-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({
    member: {
      id: updated.id,
      role: updated.role,
      status: updated.status,
    },
  });
});

export default app;
