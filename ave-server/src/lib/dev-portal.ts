import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, identities, oauthApps, organizationIdentityMembers, organizations } from "../db";
import { scopesForRole, type BusinessRole } from "./business";

export type OrganizationRole = "owner" | "admin" | "viewer";

const roleRank: Record<OrganizationRole, number> = {
  owner: 3,
  admin: 2,
  viewer: 1,
};

export function mapBusinessRoleToOrganizationRole(role: string): OrganizationRole {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  return "viewer";
}

export function businessRoleForOrganizationRole(role: OrganizationRole): BusinessRole {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  return "viewer";
}

export function signingAuthorityForOrganizationRole(role: OrganizationRole): boolean {
  return role === "owner" || role === "admin";
}

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

async function getUserIdentities(userId: string) {
  return db
    .select()
    .from(identities)
    .where(eq(identities.userId, userId));
}

async function getPrimaryIdentity(userId: string) {
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.userId, userId), eq(identities.isPrimary, true)))
    .limit(1);

  if (identity) return identity;

  const [fallback] = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, userId))
    .limit(1);

  return fallback ?? null;
}

function selectHighestMembership<T extends { role: OrganizationRole }>(memberships: T[]) {
  return memberships
    .sort((a, b) => roleRank[b.role] - roleRank[a.role])[0] ?? null;
}

async function getBusinessOrganizationMemberships(userId: string) {
  const userIdentities = await getUserIdentities(userId);
  const identityIds = userIdentities.map((identity) => identity.id);
  if (!identityIds.length) return [];

  const rows = await db
    .select({
      member: organizationIdentityMembers,
      identity: identities,
      organization: organizations,
    })
    .from(organizationIdentityMembers)
    .innerJoin(identities, eq(identities.id, organizationIdentityMembers.identityId))
    .innerJoin(organizations, eq(organizations.id, organizationIdentityMembers.organizationId))
    .where(and(inArray(organizationIdentityMembers.identityId, identityIds), eq(organizationIdentityMembers.status, "active")));

  const byOrganization = new Map<string, {
    memberId: string;
    role: OrganizationRole;
    status: string;
    invitedEmail: null;
    organization: typeof organizations.$inferSelect;
    identity: typeof identities.$inferSelect;
  }>();

  for (const row of rows) {
    const membership = {
      memberId: row.member.id,
      role: mapBusinessRoleToOrganizationRole(row.member.role),
      status: row.member.status,
      invitedEmail: null,
      organization: row.organization,
      identity: row.identity,
    };
    const existing = byOrganization.get(row.organization.id);
    if (!existing || roleRank[membership.role] > roleRank[existing.role]) {
      byOrganization.set(row.organization.id, membership);
    }
  }

  return [...byOrganization.values()];
}

export async function ensurePersonalOrganization(userId: string) {
  const existingMembership = selectHighestMembership(await getBusinessOrganizationMemberships(userId));
  if (existingMembership) return existingMembership.organization;

  const primaryIdentity = await getPrimaryIdentity(userId);
  if (!primaryIdentity) {
    throw new Error("A primary identity is required before creating an organization");
  }

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
      plan: "business",
    })
    .returning();

  await db.insert(organizationIdentityMembers).values({
    organizationId: organization.id,
    identityId: primaryIdentity.id,
    addedByUserId: userId,
    addedByIdentityId: primaryIdentity.id,
    role: "owner",
    scopes: scopesForRole("owner"),
    signingAuthority: true,
    status: "active",
  });

  return organization;
}

export async function createOrganization(userId: string, name: string) {
  const primaryIdentity = await getPrimaryIdentity(userId);
  if (!primaryIdentity) {
    throw new Error("A primary identity is required before creating an organization");
  }

  const slug = await createUniqueSlug(name);

  const [organization] = await db
    .insert(organizations)
    .values({
      name,
      slug,
      ownerUserId: userId,
      verifiedDomains: [],
      appLimit: 12,
      plan: "business",
    })
    .returning();

  await db.insert(organizationIdentityMembers).values({
    organizationId: organization.id,
    identityId: primaryIdentity.id,
    addedByUserId: userId,
    addedByIdentityId: primaryIdentity.id,
    role: "owner",
    scopes: scopesForRole("owner"),
    signingAuthority: true,
    status: "active",
  });

  return organization;
}

export async function getOrganizationMemberships(userId: string) {
  await ensurePersonalOrganization(userId);
  return getBusinessOrganizationMemberships(userId);
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
  const userIdentities = await getUserIdentities(userId);
  const identityIds = userIdentities.map((identity) => identity.id);
  if (!identityIds.length) return null;

  const memberships = await db
    .select({
      member: organizationIdentityMembers,
      identity: identities,
      organization: organizations,
    })
    .from(organizationIdentityMembers)
    .innerJoin(identities, eq(identities.id, organizationIdentityMembers.identityId))
    .innerJoin(organizations, eq(organizations.id, organizationIdentityMembers.organizationId))
    .where(
      and(
        eq(organizationIdentityMembers.organizationId, organizationId),
        eq(organizationIdentityMembers.status, "active"),
        inArray(organizationIdentityMembers.identityId, identityIds),
      ),
    );

  const membership = selectHighestMembership(memberships.map((entry) => ({
    memberId: entry.member.id,
    role: mapBusinessRoleToOrganizationRole(entry.member.role),
    status: entry.member.status,
    invitedEmail: null,
    organization: entry.organization,
    identity: entry.identity,
    member: entry.member,
  })));
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
