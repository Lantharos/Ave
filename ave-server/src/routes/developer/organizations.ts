import { recordActivityLog } from "../../lib/platform/background-events";
import { zValidator } from "@hono/zod-validator";
import { eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db, identities, oauthApps, oauthAuthorizations, developerMembers, organizations } from "../../db";
import {
  createOrganization,
  getOrganizationMemberships,
  requireOrganizationAccess,
} from "../../lib/developer/dev-portal";
import { requireAuth, requireWritableForMutation } from "../../middleware/auth";
import { serializeApp } from "../apps";
import organizationMemberRoutes from "./organization-members";

const app = new Hono();

app.use("*", requireAuth);
app.use("*", requireWritableForMutation);

app.route("/", organizationMemberRoutes);


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
    appCount: appCountByOrganizationId.get(membership.organization.id) || 0,
    memberCount: memberCountByOrganizationId.get(membership.organization.id) || 0,
  };
}

function mapWorkspaceMembers(members: Array<{
  member: typeof developerMembers.$inferSelect;
  identity: typeof identities.$inferSelect;
}>) {
  return members.map(({ member, identity }) => ({
    id: member.id,
    userId: identity.userId,
    name: identity.displayName || identity.handle,
    email: identity.email,
    avatarUrl: identity.avatarUrl,
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
          organizationId: developerMembers.organizationId,
          memberId: developerMembers.id,
        })
        .from(developerMembers)
        .where(inArray(developerMembers.organizationId, organizationIds))
    : [];

  const memberCountByOrganizationId = new Map<string, number>();
  for (const row of memberRows) {
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

  const membership = memberships.find((entry) => entry.organization.id === currentOrganizationId);
  if (!membership) return c.json({ error: "Organization not found" }, 404);

  const [appRows, memberRows, authorizationCounts] = await Promise.all([
    db
      .select()
      .from(oauthApps)
      .where(inArray(oauthApps.organizationId, organizationIds)),
    db
      .select({ member: developerMembers, identity: identities })
      .from(developerMembers)
      .innerJoin(identities, eq(identities.id, developerMembers.identityId))
      .where(inArray(developerMembers.organizationId, organizationIds)),
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
  const members = memberRows.filter(({ member }) => member.organizationId === currentOrganizationId);
  const apps = appRows.filter((appRow) => appRow.organizationId === currentOrganizationId);

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
      members: mapWorkspaceMembers(members),
      appCount: apps.length,
    },
    apps: apps.map((appRow) =>
      serializeApp(appRow, identityCountByAppId.get(appRow.id) || 0),
    ),
  });
});

app.post("/", zValidator("json", z.object({
  name: z.string().min(2).max(80),
})), async (c) => {
  const user = c.get("user")!;
  const payload = c.req.valid("json");

  const { organization } = await createOrganization(user.id, payload.name.trim());

  return c.json({
    organization: {
      id: organization.id,
      name: organization.name,
      logoUrl: organization.logoUrl,
      slug: organization.slug,
      appCount: 0,
      memberCount: 1,
    },
  }, 201);
});

app.get("/:organizationId", async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");

  const membership = await requireOrganizationAccess(user, organizationId);
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const members = await db
    .select({ member: developerMembers, identity: identities })
    .from(developerMembers)
    .innerJoin(identities, eq(identities.id, developerMembers.identityId))
    .where(eq(developerMembers.organizationId, organizationId));

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
      members: mapWorkspaceMembers(members),
      appCount: apps.length,
    },
  });
});

app.patch("/:organizationId", zValidator("json", z.object({
  name: z.string().min(2).max(80).optional(),
  logoUrl: z.string().url().nullable().optional(),
}).strict()), async (c) => {
  const user = c.get("user")!;
  const organizationId = c.req.param("organizationId");
  const payload = c.req.valid("json");

  const membership = await requireOrganizationAccess(user, organizationId);
  if (!membership) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const details = { organizationId, name: payload.name, logoUrl: payload.logoUrl };

  const [updated] = await db
    .update(organizations)
    .set({
      name: payload.name ?? membership.organization.name,
      logoUrl: payload.logoUrl === undefined ? membership.organization.logoUrl : payload.logoUrl,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning();

  recordActivityLog(c, {
    userId: user.id,
    action: "workspace.updated",
    details,
    deviceId: user.deviceId,
    ipAddress: c.req.header("cf-connecting-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({
    organization: {
      id: updated.id,
      name: updated.name,
      logoUrl: updated.logoUrl,
      slug: updated.slug,
    },
  });
});

export default app;
