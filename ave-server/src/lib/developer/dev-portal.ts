import { and, eq } from "drizzle-orm";
import { db, identities, oauthApps, developerMembers, organizations } from "../../db";
import type { AuthUser } from "../../middleware/auth";

export type OrganizationRole = "owner" | "admin" | "viewer";
const roleRank: Record<OrganizationRole, number> = { owner: 3, admin: 2, viewer: 1 };

export function canManageRole(actor: OrganizationRole, target: OrganizationRole): boolean {
  return actor === "owner" || roleRank[actor] > roleRank[target];
}

function mapMembership(row: {
  member: typeof developerMembers.$inferSelect;
  identity: typeof identities.$inferSelect;
  organization: typeof organizations.$inferSelect;
}) {
  return { ...row, memberId: row.member.id, role: row.member.role, status: row.member.status };
}

async function listMemberships(userId: string, organizationId?: string) {
  const rows = await db.select({ member: developerMembers, identity: identities, organization: organizations })
    .from(developerMembers)
    .innerJoin(identities, eq(identities.id, developerMembers.identityId))
    .innerJoin(organizations, eq(organizations.id, developerMembers.organizationId))
    .where(and(
      eq(identities.userId, userId),
      eq(developerMembers.status, "active"),
      organizationId ? eq(organizations.id, organizationId) : undefined,
    ));
  const memberships = new Map<string, ReturnType<typeof mapMembership>>();
  for (const row of rows) {
    const previous = memberships.get(row.organization.id);
    if (!previous || roleRank[row.member.role] > roleRank[previous.role]) {
      memberships.set(row.organization.id, mapMembership(row));
    }
  }
  return [...memberships.values()];
}

export async function createOrganization(userId: string, name: string) {
  const userIdentities = await db.select().from(identities).where(eq(identities.userId, userId));
  const identity = userIdentities.find((entry) => entry.isPrimary) ?? userIdentities[0];
  if (!identity) throw new Error("A primary identity is required before creating a developer team");
  const id = crypto.randomUUID();
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team"}-${id}`;
  await db.batch([
    db.insert(organizations).values({ id, name, slug, ownerUserId: userId }),
    db.insert(developerMembers).values({ organizationId: id, identityId: identity.id, role: "owner", status: "active" }),
  ]);
  const [membership] = await listMemberships(userId, id);
  return membership;
}

export async function getOrganizationMemberships(userId: string) {
  const memberships = await listMemberships(userId);
  return memberships.length ? memberships : [await createOrganization(userId, "My workspace")];
}

export async function ensurePersonalOrganization(userId: string) {
  const memberships = await getOrganizationMemberships(userId);
  return memberships.sort((a, b) => roleRank[b.role] - roleRank[a.role])[0].organization;
}

export async function requireOrganizationAccess(user: AuthUser, organizationId: string, minimumRole: OrganizationRole = "viewer") {
  const [membership] = await listMemberships(user.id, organizationId);
  return membership && roleRank[membership.role] >= roleRank[minimumRole] ? membership : null;
}

export async function getAccessibleApps(user: AuthUser, organizationId?: string) {
  const membership = organizationId
    ? await requireOrganizationAccess(user, organizationId)
    : (await getOrganizationMemberships(user.id))[0];
  if (!membership) return [];
  return db.select().from(oauthApps).where(eq(oauthApps.organizationId, membership.organization.id));
}

export async function getAccessibleApp(user: AuthUser, appId: string, minimumRole: OrganizationRole = "viewer") {
  const rows = await db.select({ app: oauthApps, member: developerMembers, identity: identities, organization: organizations })
    .from(oauthApps)
    .innerJoin(organizations, eq(organizations.id, oauthApps.organizationId))
    .innerJoin(developerMembers, and(eq(developerMembers.organizationId, organizations.id), eq(developerMembers.status, "active")))
    .innerJoin(identities, and(eq(identities.id, developerMembers.identityId), eq(identities.userId, user.id)))
    .where(eq(oauthApps.id, appId));
  const row = rows.filter((entry) => roleRank[entry.member.role] >= roleRank[minimumRole])
    .sort((a, b) => roleRank[b.member.role] - roleRank[a.member.role])[0];
  return row ? { app: row.app, membership: mapMembership(row) } : null;
}
