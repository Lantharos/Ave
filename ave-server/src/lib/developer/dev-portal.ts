import { and, eq, notExists, sql } from "drizzle-orm";
import { db, identities, oauthApps, developerMembers, organizations } from "../../db";
import type { AuthUser } from "../../middleware/auth";

type MembershipRow = {
  member: typeof developerMembers.$inferSelect;
  identity: typeof identities.$inferSelect;
  organization: typeof organizations.$inferSelect;
};

async function listMemberships(userId: string, organizationId?: string) {
  const rows = await db.select({ member: developerMembers, identity: identities, organization: organizations })
    .from(developerMembers)
    .innerJoin(identities, eq(identities.id, developerMembers.identityId))
    .innerJoin(organizations, eq(organizations.id, developerMembers.organizationId))
    .where(and(
      eq(identities.userId, userId),
      organizationId ? eq(organizations.id, organizationId) : undefined,
    ));
  const memberships = new Map<string, MembershipRow>();
  for (const row of rows) {
    if (!memberships.has(row.organization.id)) memberships.set(row.organization.id, row);
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
    db.insert(organizations).values({ id, name, slug }),
    db.insert(developerMembers).values({ organizationId: id, identityId: identity.id }),
  ]);
  const [membership] = await listMemberships(userId, id);
  return membership;
}

export async function getOrganizationMemberships(userId: string) {
  const memberships = await listMemberships(userId);
  return memberships.length ? memberships : [await createOrganization(userId, "My workspace")];
}

export async function ensurePersonalOrganization(userId: string) {
  const [membership] = await getOrganizationMemberships(userId);
  return membership.organization;
}

export async function requireOrganizationAccess(user: AuthUser, organizationId: string) {
  const [membership] = await listMemberships(user.id, organizationId);
  return membership ?? null;
}

export async function getAccessibleApps(user: AuthUser, organizationId?: string) {
  const membership = organizationId
    ? await requireOrganizationAccess(user, organizationId)
    : (await getOrganizationMemberships(user.id))[0];
  if (!membership) return [];
  return db.select().from(oauthApps).where(eq(oauthApps.organizationId, membership.organization.id));
}

export async function getAccessibleApp(user: AuthUser, appId: string) {
  const [row] = await db.select({ app: oauthApps })
    .from(oauthApps)
    .innerJoin(developerMembers, eq(developerMembers.organizationId, oauthApps.organizationId))
    .innerJoin(identities, and(eq(identities.id, developerMembers.identityId), eq(identities.userId, user.id)))
    .where(eq(oauthApps.id, appId))
    .limit(1);
  return row?.app ?? null;
}

export function deleteEmptyOrganizations() {
  return db.delete(organizations).where(notExists(
    db.select({ id: sql`1` }).from(developerMembers).where(eq(developerMembers.organizationId, organizations.id)),
  ));
}
