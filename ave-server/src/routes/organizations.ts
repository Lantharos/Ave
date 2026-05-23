import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, inArray, or } from "drizzle-orm";
import { db, identities, oauthApps, oauthAuthorizations, organizationIdentityMembers, organizations } from "../db";
import { requireAuth, requireWritableForMutation } from "../middleware/auth";
import {
  businessRoleForOrganizationRole,
  createOrganization,
  getOrganizationMemberships,
  mapBusinessRoleToOrganizationRole,
  requireOrganizationAccess,
  signingAuthorityForOrganizationRole,
  type OrganizationRole,
} from "../lib/dev-portal";
import { scopesForRole } from "../lib/business";
import { listAppResources, serializeApp } from "./apps";

const app = new Hono();

app.use("*", requireAuth);
app.use("*", requireWritableForMutation);

const roleSchema = z.enum(["owner", "admin", "viewer"]);

function mapOrganizationSummary(
  membership: Awaited<ReturnType<typeof getOrganizationMemberships>>[number],
  appCountByOrganizationId: Map<string, number>,
  memberCountByOrganizationId: Map<string, number>,
) {
  return {
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
  };
}

function mapWorkspaceMembers(members: Array<{
  member: typeof organizationIdentityMembers.$inferSelect;
  identity: typeof identities.$inferSelect;
}>) {
  return members.map(({ member, identity }) => ({
    id: member.id,
    userId: identity.userId,
    name: identity.displayName || identity.handle,
    email: identity.email,
    avatarUrl: identity.avatarUrl,
    role: mapBusinessRoleToOrganizationRole(member.role),
    status: "active" as const,
    joinedAt: member.createdAt,
  }));
}

app.get("/", async (c) => {
  const user = c.get("user")!;
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
          organizationId: organizationIdentityMembers.organizationId,
          memberId: organizationIdentityMembers.id,
          status: organizationIdentityMembers.status,
        })
        .from(organizationIdentityMembers)
        .where(inArray(organizationIdentityMembers.organizationId, organizationIds))
    : [];

  const memberCountByOrganizationId = new Map<string, number>();
  for (const row of memberRows) {
    if (row.status !== "active") continue;
    memberCountByOrganizationId.set(row.organizationId, (memberCountByOrganizationId.get(row.organizationId) || 0) + 1);
  }

  const currentOrganizationId = c.req.query("organizationId") || memberships[0]?.organization.id || null;
  return c.json({
    organizations: memberships.map((membership) =>
      mapOrganizationSummary(membership, appCountByOrganizationId, memberCountByOrganizationId),
    ),
    currentOrganizationId,
  });
});

app.get("/bootstrap", async (c) => {
  const user = c.get("user")!;
  const memberships = await getOrganizationMemberships(user.id);
  const organizationIds = memberships.map((membership) => membership.organization.id);

  const [appRows, memberRows] = await Promise.all([
    organizationIds.length
      ? db
          .select({
            organizationId: oauthApps.organizationId,
            appId: oauthApps.id,
          })
          .from(oauthApps)
          .where(inArray(oauthApps.organizationId, organizationIds))
      : [],
    organizationIds.length
      ? db
          .select({
            organizationId: organizationIdentityMembers.organizationId,
            memberId: organizationIdentityMembers.id,
            status: organizationIdentityMembers.status,
          })
          .from(organizationIdentityMembers)
          .where(inArray(organizationIdentityMembers.organizationId, organizationIds))
      : [],
  ]);

  const appCountByOrganizationId = new Map<string, number>();
  for (const row of appRows) {
    const organizationId = row.organizationId;
    if (!organizationId) continue;
    appCountByOrganizationId.set(organizationId, (appCountByOrganizationId.get(organizationId) || 0) + 1);
  }

  const memberCountByOrganizationId = new Map<string, number>();
  for (const row of memberRows) {
    if (row.status !== "active") continue;
    memberCountByOrganizationId.set(row.organizationId, (memberCountByOrganizationId.get(row.organizationId) || 0) + 1);
  }

  const currentOrganizationId = c.req.query("organizationId") || memberships[0]?.organization.id || null;
  const organizationsSummary = memberships.map((membership) =>
    mapOrganizationSummary(membership, appCountByOrganizationId, memberCountByOrganizationId),
  );

  if (!currentOrganizationId) {
    return c.json({
      organizations: organizationsSummary,
      currentOrganizationId: null,
      organization: null,
      apps: [],
    });
  }

  const membership = await requireOrganizationAccess(user.id, currentOrganizationId, "viewer");
  if (!membership) {
    return c.json({
      organizations: organizationsSummary,
      currentOrganizationId,
      organization: null,
      apps: [],
    });
  }

  const [members, apps] = await Promise.all([
    db
      .select({ member: organizationIdentityMembers, identity: identities })
      .from(organizationIdentityMembers)
      .innerJoin(identities, eq(identities.id, organizationIdentityMembers.identityId))
      .where(and(eq(organizationIdentityMembers.organizationId, currentOrganizationId), eq(organizationIdentityMembers.status, "active"))),
    db
      .select()
      .from(oauthApps)
      .where(eq(oauthApps.organizationId, currentOrganizationId)),
  ]);

  const [resources, authorizations] = await Promise.all([
    listAppResources(apps.map((app) => app.id)),
    apps.length
      ? db
          .select({
            appId: oauthAuthorizations.appId,
            identityId: oauthAuthorizations.identityId,
          })
          .from(oauthAuthorizations)
          .where(inArray(oauthAuthorizations.appId, apps.map((app) => app.id)))
      : [],
  ]);

  const resourcesByAppId = new Map<string, typeof resources>();
  for (const resource of resources) {
    const list = resourcesByAppId.get(resource.ownerAppId) || [];
    list.push(resource);
    resourcesByAppId.set(resource.ownerAppId, list);
  }

  const identityIdsByAppId = new Map<string, Set<string>>();
  for (const authorization of authorizations) {
    const existing = identityIdsByAppId.get(authorization.appId) || new Set<string>();
    existing.add(authorization.identityId);
    identityIdsByAppId.set(authorization.appId, existing);
  }

  return c.json({
    organizations: organizationsSummary,
    currentOrganizationId,
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      logoUrl: membership.organization.logoUrl,
      slug: membership.organization.slug,
      plan: membership.organization.plan,
      verifiedDomains: (membership.organization.verifiedDomains as string[] | null) || [],
      appLimit: membership.organization.appLimit,
      role: membership.role,
      members: mapWorkspaceMembers(members),
      appCount: apps.length,
    },
    apps: apps.map((appRow) =>
      serializeApp(
        appRow,
        resourcesByAppId.get(appRow.id) || [],
        identityIdsByAppId.get(appRow.id)?.size || 0,
      ),
    ),
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
    .select({ member: organizationIdentityMembers, identity: identities })
    .from(organizationIdentityMembers)
    .innerJoin(identities, eq(identities.id, organizationIdentityMembers.identityId))
    .where(and(eq(organizationIdentityMembers.organizationId, organizationId), eq(organizationIdentityMembers.status, "active")));

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
      members: mapWorkspaceMembers(members),
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

  const lookup = payload.email.trim();
  const handleLookup = lookup.replace(/^@/, "").toLowerCase();
  const [targetIdentity] = await db
    .select()
    .from(identities)
    .where(or(eq(identities.handle, handleLookup), eq(identities.email, lookup.toLowerCase())))
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

  const role = businessRoleForOrganizationRole(payload.role);
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
})), async (c) => {
  const user = c.get("user")!;
  const { organizationId, memberId } = c.req.param();
  const payload = c.req.valid("json");

  const membership = await requireOrganizationAccess(user.id, organizationId, "admin");
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

  const role = businessRoleForOrganizationRole(payload.role);
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

  return c.json({
    member: {
      id: updated.id,
      role: mapBusinessRoleToOrganizationRole(updated.role),
      status: updated.status,
    },
  });
});

export default app;
