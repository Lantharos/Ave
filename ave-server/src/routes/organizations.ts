import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db, identities, oauthApps, oauthAuthorizations, oauthResources, organizationIdentityMembers, organizations } from "../db";
import { recordBusinessAuditEvent } from "../lib/background-events";
import { hasBusinessScope, scopesForRole, type BusinessRole } from "../lib/business";
import { requireSignedAction } from "../lib/business-route-guards";
import { clientIp, userAgent } from "../lib/business-route-utils";
import {
  createOrganization,
  enforcePortalOrganizationAccess,
  getOrganizationMemberships,
  mapBusinessRoleToOrganizationRole,
  requireOrganizationAccess,
} from "../lib/dev-portal";
import { requireAuth, requireWritableForMutation } from "../middleware/auth";
import { serializeApp } from "./apps";
import organizationMemberRoutes from "./organization-members";

const app = new Hono();

app.use("*", requireAuth);
app.use("*", requireWritableForMutation);

app.route("/", organizationMemberRoutes);

const signedActionSchema = z.object({ signature: z.string().min(1).max(2000) });

function membershipContext(membership: Awaited<ReturnType<typeof getOrganizationMemberships>>[number]) {
  return {
    actingIdentityId: membership.identity.id,
    scopes: scopesForRole(membership.member.role as BusinessRole, membership.member.scopes),
    signingAuthority: membership.member.signingAuthority,
    ssoRequired: membership.organization.ssoRequired,
  };
}

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
    ...membershipContext(membership),
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
  const currentOrganizationId = c.req.query("organizationId") || memberships[0]?.organization.id || null;

  if (!currentOrganizationId || !organizationIds.length) {
    return c.json({
      organizations: [],
      currentOrganizationId: null,
      organization: null,
      apps: [],
    });
  }

  const selectedMembership = memberships.find((entry) => entry.organization.id === currentOrganizationId);
  if (!selectedMembership) return c.json({ error: "Organization not found" }, 404);
  await enforcePortalOrganizationAccess(user, selectedMembership);

  const [appRows, memberRows, resources, authorizationCounts] = await Promise.all([
    db
      .select()
      .from(oauthApps)
      .where(inArray(oauthApps.organizationId, organizationIds)),
    db
      .select({ member: organizationIdentityMembers, identity: identities })
      .from(organizationIdentityMembers)
      .innerJoin(identities, eq(identities.id, organizationIdentityMembers.identityId))
      .where(and(
        inArray(organizationIdentityMembers.organizationId, organizationIds),
        eq(organizationIdentityMembers.status, "active"),
      )),
    db
      .select({ resource: oauthResources })
      .from(oauthResources)
      .innerJoin(oauthApps, eq(oauthApps.id, oauthResources.ownerAppId))
      .where(eq(oauthApps.organizationId, currentOrganizationId)),
    db
      .select({
        appId: oauthAuthorizations.appId,
        identityCount: sql<number>`count(*)`,
      })
      .from(oauthAuthorizations)
      .innerJoin(oauthApps, eq(oauthApps.id, oauthAuthorizations.appId))
      .where(eq(oauthApps.organizationId, currentOrganizationId))
      .groupBy(oauthAuthorizations.appId),
  ]);

  const appCountByOrganizationId = new Map<string, number>();
  for (const appRow of appRows) {
    const organizationId = appRow.organizationId;
    if (!organizationId) continue;
    appCountByOrganizationId.set(organizationId, (appCountByOrganizationId.get(organizationId) || 0) + 1);
  }

  const memberCountByOrganizationId = new Map<string, number>();
  for (const { member } of memberRows) {
    memberCountByOrganizationId.set(member.organizationId, (memberCountByOrganizationId.get(member.organizationId) || 0) + 1);
  }

  const organizationsSummary = memberships.map((membership) =>
    mapOrganizationSummary(membership, appCountByOrganizationId, memberCountByOrganizationId),
  );
  const membership = memberships.find((entry) => entry.organization.id === currentOrganizationId) ?? null;
  if (!membership) {
    return c.json({
      organizations: organizationsSummary,
      currentOrganizationId,
      organization: null,
      apps: [],
    });
  }

  const members = memberRows.filter(({ member }) => member.organizationId === currentOrganizationId);
  const apps = appRows.filter((appRow) => appRow.organizationId === currentOrganizationId);

  const resourcesByAppId = new Map<string, Array<(typeof resources)[number]["resource"]>>();
  for (const { resource } of resources) {
    const list = resourcesByAppId.get(resource.ownerAppId) || [];
    list.push(resource);
    resourcesByAppId.set(resource.ownerAppId, list);
  }

  const identityCountByAppId = new Map(
    authorizationCounts.map((row) => [row.appId, Number(row.identityCount || 0)]),
  );

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
      ...membershipContext(membership),
      members: mapWorkspaceMembers(members),
      appCount: apps.length,
    },
    apps: apps.map((appRow) =>
      serializeApp(
        appRow,
        resourcesByAppId.get(appRow.id) || [],
        identityCountByAppId.get(appRow.id) || 0,
      ),
    ),
  });
});

app.post("/", zValidator("json", z.object({
  name: z.string().min(2).max(80),
})), async (c) => {
  const user = c.get("user")!;
  const payload = c.req.valid("json");

  const membership = await createOrganization(user.id, payload.name.trim());
  const { organization } = membership;

  return c.json({
    organization: {
      id: organization.id,
      name: organization.name,
      logoUrl: organization.logoUrl,
      slug: organization.slug,
      plan: organization.plan,
      verifiedDomains: (organization.verifiedDomains as string[] | null) || [],
      appLimit: organization.appLimit,
      role: membership.role,
      ...membershipContext(membership),
      appCount: 0,
      memberCount: 1,
    },
  }, 201);
});

app.get("/:organizationId", async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");

  const membership = await requireOrganizationAccess(user, organizationId, "viewer");
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
      ...membershipContext(membership),
      members: mapWorkspaceMembers(members),
      appCount: apps.length,
    },
  });
});

app.patch("/:organizationId", zValidator("json", z.object({
  name: z.string().min(2).max(80).optional(),
  logoUrl: z.string().url().nullable().optional(),
  signedAction: signedActionSchema,
}).strict()), async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");
  const payload = c.req.valid("json");

  const membership = await requireOrganizationAccess(user, organizationId, "admin");
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  if (!hasBusinessScope(membership.member, "manage_org")) return c.json({ error: "Organization management permission required" }, 403);
  const details = { organizationId, name: payload.name, logoUrl: payload.logoUrl };
  const signatureError = await requireSignedAction(c, membership.identity.id, "workspace.updated", details, payload.signedAction.signature);
  if (signatureError) return signatureError;

  const [updated] = await db
    .update(organizations)
    .set({
      name: payload.name ?? membership.organization.name,
      logoUrl: payload.logoUrl === undefined ? membership.organization.logoUrl : payload.logoUrl,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning();

  recordBusinessAuditEvent(c, {
    organizationId,
    actorUserId: user.id,
    actorIdentityId: membership.identity.id,
    action: "workspace.updated",
    details,
    signature: payload.signedAction.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });
  return c.json({
    organization: {
      ...membershipContext(membership),
      role: membership.role,
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

export default app;
