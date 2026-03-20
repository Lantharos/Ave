import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, identities, oauthApps, organizationMembers, organizations } from "../db";
import { requireAuth } from "../middleware/auth";
import {
  createOrganization,
  ensurePersonalOrganization,
  getOrganizationMemberships,
  requireOrganizationAccess,
  type OrganizationRole,
} from "../lib/dev-portal";

const app = new Hono();

app.use("*", requireAuth);

const roleSchema = z.enum(["owner", "admin", "viewer"]);

app.get("/", async (c) => {
  const user = c.get("user")!;
  await ensurePersonalOrganization(user.id);

  const memberships = await getOrganizationMemberships(user.id);
  const organizationIds = memberships.map((membership) => membership.organization.id);

  const appRows = organizationIds.length
    ? await db
        .select({
          organizationId: oauthApps.organizationId,
          appId: oauthApps.id,
        })
        .from(oauthApps)
        .where(inArray(oauthApps.organizationId, organizationIds))
    : [];

  const appCountByOrganizationId = new Map<string, number>();
  for (const row of appRows) {
    const organizationId = row.organizationId;
    if (!organizationId) continue;
    appCountByOrganizationId.set(organizationId, (appCountByOrganizationId.get(organizationId) || 0) + 1);
  }

  const memberRows = organizationIds.length
    ? await db
        .select({
          organizationId: organizationMembers.organizationId,
          memberId: organizationMembers.id,
          userId: organizationMembers.userId,
          invitedEmail: organizationMembers.invitedEmail,
          role: organizationMembers.role,
          status: organizationMembers.status,
          createdAt: organizationMembers.createdAt,
        })
        .from(organizationMembers)
        .where(inArray(organizationMembers.organizationId, organizationIds))
    : [];

  const memberCountByOrganizationId = new Map<string, number>();
  for (const row of memberRows) {
    if (row.status !== "active") continue;
    memberCountByOrganizationId.set(row.organizationId, (memberCountByOrganizationId.get(row.organizationId) || 0) + 1);
  }

  const currentOrganizationId = c.req.query("organizationId") || memberships[0]?.organization.id || null;
  return c.json({
    organizations: memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      logoUrl: membership.organization.logoUrl,
      slug: membership.organization.slug,
      plan: membership.organization.plan,
      verifiedDomains: (membership.organization.verifiedDomains as string[] | null) || [],
      appLimit: membership.organization.appLimit,
      role: membership.role,
      appCount: appCountByOrganizationId.get(membership.organization.id) || 0,
      memberCount: memberCountByOrganizationId.get(membership.organization.id) || 0,
    })),
    currentOrganizationId,
  });
});

app.post("/", zValidator("json", z.object({
  name: z.string().min(2).max(80),
})), async (c) => {
  const user = c.get("user")!;
  const payload = c.req.valid("json");

  const organization = await createOrganization(user.id, payload.name.trim());

  return c.json({
    organization: {
      id: organization.id,
      name: organization.name,
      logoUrl: organization.logoUrl,
      slug: organization.slug,
      plan: organization.plan,
      verifiedDomains: (organization.verifiedDomains as string[] | null) || [],
      appLimit: organization.appLimit,
      role: "owner",
      appCount: 0,
      memberCount: 1,
    },
  }, 201);
});

app.get("/:organizationId", async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");

  const membership = await requireOrganizationAccess(user.id, organizationId, "viewer");
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const members = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));

  const userIds = members.map((member) => member.userId).filter((value): value is string => !!value);
  const identityRows = userIds.length
    ? await db
        .select({
          userId: identities.userId,
          displayName: identities.displayName,
          email: identities.email,
          avatarUrl: identities.avatarUrl,
        })
        .from(identities)
        .where(inArray(identities.userId, userIds))
    : [];

  const identityByUserId = new Map<string, (typeof identityRows)[number]>();
  for (const identity of identityRows) {
    if (!identityByUserId.has(identity.userId)) {
      identityByUserId.set(identity.userId, identity);
    }
  }

  const apps = await db
    .select({
      id: oauthApps.id,
    })
    .from(oauthApps)
    .where(eq(oauthApps.organizationId, organizationId));

  return c.json({
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      logoUrl: membership.organization.logoUrl,
      slug: membership.organization.slug,
      plan: membership.organization.plan,
      verifiedDomains: (membership.organization.verifiedDomains as string[] | null) || [],
      appLimit: membership.organization.appLimit,
      role: membership.role,
      members: members.map((member) => {
        const identity = member.userId ? identityByUserId.get(member.userId) : null;
        return {
          id: member.id,
          userId: member.userId,
          name: identity?.displayName || member.invitedEmail?.split("@")[0] || "Pending member",
          email: identity?.email || member.invitedEmail,
          avatarUrl: identity?.avatarUrl,
          role: member.role,
          status: member.status,
          joinedAt: member.createdAt,
        };
      }),
      appCount: apps.length,
    },
  });
});

app.patch("/:organizationId", zValidator("json", z.object({
  name: z.string().min(2).max(80).optional(),
  logoUrl: z.string().url().nullable().optional(),
  verifiedDomains: z.array(z.string().min(3).max(255)).optional(),
})), async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");
  const payload = c.req.valid("json");

  const membership = await requireOrganizationAccess(user.id, organizationId, "admin");
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const [updated] = await db
    .update(organizations)
    .set({
      name: payload.name ?? membership.organization.name,
      logoUrl: payload.logoUrl === undefined ? membership.organization.logoUrl : payload.logoUrl,
      verifiedDomains: payload.verifiedDomains ?? ((membership.organization.verifiedDomains as string[] | null) || []),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning();

  return c.json({
    organization: {
      id: updated.id,
      name: updated.name,
      logoUrl: updated.logoUrl,
      slug: updated.slug,
      plan: updated.plan,
      verifiedDomains: (updated.verifiedDomains as string[] | null) || [],
      appLimit: updated.appLimit,
    },
  });
});

app.post("/:organizationId/invites", zValidator("json", z.object({
  email: z.string().email(),
  role: roleSchema.default("admin"),
})), async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");
  const payload = c.req.valid("json");

  const membership = await requireOrganizationAccess(user.id, organizationId, "admin");
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  if (payload.role === "owner") {
    return c.json({ error: "Workspace owner cannot be reassigned" }, 400);
  }

  const [existingInvite] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.invitedEmail, payload.email.toLowerCase())))
    .limit(1);

  if (existingInvite) {
    return c.json({ error: "Invite already exists" }, 409);
  }

  const [created] = await db
    .insert(organizationMembers)
    .values({
      organizationId,
      invitedEmail: payload.email.toLowerCase(),
      role: payload.role,
      status: "invited",
      invitedByUserId: user.id,
    })
    .returning();

  return c.json({
    member: {
      id: created.id,
      name: payload.email.split("@")[0],
      email: created.invitedEmail,
      role: created.role,
      status: created.status,
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

  const membership = await requireOrganizationAccess(user.id, organizationId, "admin");
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const [target] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, organizationId)))
    .limit(1);

  if (!target) {
    return c.json({ error: "Member not found" }, 404);
  }

  if (target.status !== "active") {
    return c.json({ error: "Cannot change role for a pending invite" }, 400);
  }

  if (target.userId === membership.organization.ownerUserId && payload.role !== "owner") {
    return c.json({ error: "Cannot demote the workspace owner" }, 400);
  }

  if (payload.role === "owner" && target.userId !== membership.organization.ownerUserId) {
    return c.json({ error: "Workspace owner cannot be reassigned" }, 400);
  }

  const [updated] = await db
    .update(organizationMembers)
    .set({
      role: payload.role as OrganizationRole,
      updatedAt: new Date(),
    })
    .where(eq(organizationMembers.id, memberId))
    .returning();

  return c.json({
    member: {
      id: updated.id,
      role: updated.role,
      status: updated.status,
    },
  });
});

export default app;
