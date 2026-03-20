import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, identities, oauthApps, organizationMembers, organizations } from "../db";

export type OrganizationRole = "owner" | "admin" | "viewer";

const roleRank: Record<OrganizationRole, number> = {
  owner: 3,
  admin: 2,
  viewer: 1,
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
}

async function createUniqueSlug(baseValue: string): Promise<string> {
  const baseSlug = slugify(baseValue);
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, candidate))
      .limit(1);

    if (!existing) return candidate;

    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }
}

export async function ensurePersonalOrganization(userId: string) {
  const [existingMembership] = await db
    .select({
      organizationId: organizationMembers.organizationId,
    })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, "active")))
    .limit(1);

  if (existingMembership) {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, existingMembership.organizationId))
      .limit(1);

    if (organization) return organization;
  }

  const [primaryIdentity] = await db
    .select({
      displayName: identities.displayName,
    })
    .from(identities)
    .where(and(eq(identities.userId, userId), eq(identities.isPrimary, true)))
    .limit(1);

  const workspaceName = primaryIdentity?.displayName
    ? `${primaryIdentity.displayName.split(" ")[0]}'s workspace`
    : "Ave workspace";

  const slug = await createUniqueSlug(workspaceName);

  const [organization] = await db
    .insert(organizations)
    .values({
      name: workspaceName,
      slug,
      ownerUserId: userId,
      verifiedDomains: [],
      appLimit: 12,
      plan: "core",
    })
    .returning();

  await db.insert(organizationMembers).values({
    organizationId: organization.id,
    userId,
    role: "owner",
    status: "active",
    invitedByUserId: userId,
  });

  return organization;
}

export async function createOrganization(userId: string, name: string) {
  const slug = await createUniqueSlug(name);

  const [organization] = await db
    .insert(organizations)
    .values({
      name,
      slug,
      ownerUserId: userId,
      verifiedDomains: [],
      appLimit: 12,
      plan: "core",
    })
    .returning();

  await db.insert(organizationMembers).values({
    organizationId: organization.id,
    userId,
    role: "owner",
    status: "active",
    invitedByUserId: userId,
  });

  return organization;
}

export async function getOrganizationMemberships(userId: string) {
  await ensurePersonalOrganization(userId);

  const memberships = await db
    .select({
      memberId: organizationMembers.id,
      role: organizationMembers.role,
      status: organizationMembers.status,
      invitedEmail: organizationMembers.invitedEmail,
      organization: organizations,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, "active")));

  return memberships.map((entry) => ({
    memberId: entry.memberId,
    role: entry.role as OrganizationRole,
    status: entry.status,
    invitedEmail: entry.invitedEmail,
    organization: entry.organization,
  }));
}

export async function backfillOwnedAppsOrganization(userId: string) {
  const organization = await ensurePersonalOrganization(userId);
  await db
    .update(oauthApps)
    .set({ organizationId: organization.id })
    .where(and(eq(oauthApps.ownerId, userId), isNull(oauthApps.organizationId)));

  return organization;
}

export async function requireOrganizationAccess(userId: string, organizationId: string, minimumRole: OrganizationRole = "viewer") {
  const memberships = await getOrganizationMemberships(userId);
  const membership = memberships.find((entry) => entry.organization.id === organizationId);

  if (!membership) return null;
  if (roleRank[membership.role] < roleRank[minimumRole]) return null;

  return membership;
}

export async function getAccessibleOrganizationIds(userId: string) {
  const memberships = await getOrganizationMemberships(userId);
  return memberships.map((entry) => entry.organization.id);
}

export async function getAccessibleApps(userId: string, organizationId?: string) {
  await backfillOwnedAppsOrganization(userId);
  const accessibleOrganizationIds = await getAccessibleOrganizationIds(userId);
  if (!accessibleOrganizationIds.length) return [];

  const targetOrganizationId = organizationId && accessibleOrganizationIds.includes(organizationId)
    ? organizationId
    : accessibleOrganizationIds[0];

  return db
    .select()
    .from(oauthApps)
    .where(
      targetOrganizationId
        ? eq(oauthApps.organizationId, targetOrganizationId)
        : inArray(oauthApps.organizationId, accessibleOrganizationIds),
    );
}

export async function getAccessibleApp(userId: string, appId: string, minimumRole: OrganizationRole = "viewer") {
  const [app] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.id, appId))
    .limit(1);

  if (!app?.organizationId) return null;

  const membership = await requireOrganizationAccess(userId, app.organizationId, minimumRole);
  if (!membership) return null;

  return {
    app,
    membership,
  };
}
