import { and, eq, inArray } from "drizzle-orm";
import { db, identities, oauthApps, organizationIdentityMembers, organizations } from "../db";
import {
  createBusinessOrganization,
  getUserBusinessIdentities,
  listBusinessOrganizationsForUser,
  requireBusinessAccess,
  type BusinessRole,
} from "./business";

export type OrganizationRole = "owner" | "admin" | "viewer";
type BusinessMembership = Awaited<ReturnType<typeof listBusinessOrganizationsForUser>>[number];

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

async function getPrimaryIdentity(userId: string) {
  const identities = await getUserBusinessIdentities(userId);
  return identities.find((identity) => identity.isPrimary) ?? identities[0] ?? null;
}

function selectHighestMembership<T extends { role: OrganizationRole }>(memberships: T[]) {
  return memberships
    .sort((a, b) => roleRank[b.role] - roleRank[a.role])[0] ?? null;
}

function mapBusinessMembership(row: BusinessMembership) {
  return {
    memberId: row.member.id,
    role: mapBusinessRoleToOrganizationRole(row.member.role),
    status: row.member.status,
    invitedEmail: null,
    organization: row.organization,
    identity: row.identity,
    member: row.member,
  };
}

async function listOrganizationMemberships(userId: string) {
  return (await listBusinessOrganizationsForUser(userId)).map(mapBusinessMembership);
}

async function createPersonalOrganization(userId: string) {
  const primaryIdentity = await getPrimaryIdentity(userId);
  if (!primaryIdentity) {
    throw new Error("A primary identity is required before creating an organization");
  }

  const workspaceName = primaryIdentity?.displayName
    ? `${primaryIdentity.displayName.split(" ")[0]}'s workspace`
    : "Ave workspace";

  const created = await createBusinessOrganization(userId, workspaceName, primaryIdentity.id);
  if (!created) {
    throw new Error("A primary identity is required before creating an organization");
  }

  return mapBusinessMembership(created);
}

export async function ensurePersonalOrganization(userId: string) {
  const existingMembership = selectHighestMembership(await getOrganizationMemberships(userId));
  if (existingMembership) return existingMembership.organization;
  throw new Error("A primary identity is required before creating an organization");
}

export async function createOrganization(userId: string, name: string) {
  const primaryIdentity = await getPrimaryIdentity(userId);
  if (!primaryIdentity) {
    throw new Error("A primary identity is required before creating an organization");
  }

  const created = await createBusinessOrganization(userId, name, primaryIdentity.id);
  if (!created) {
    throw new Error("A primary identity is required before creating an organization");
  }

  return created.organization;
}

export async function getOrganizationMemberships(userId: string) {
  const memberships = await listOrganizationMemberships(userId);
  if (memberships.length) return memberships;
  return [await createPersonalOrganization(userId)];
}

export async function requireOrganizationAccess(userId: string, organizationId: string, minimumRole: OrganizationRole = "viewer") {
  const membership = await requireBusinessAccess(userId, organizationId, businessRoleForOrganizationRole(minimumRole));
  if (!membership) return null;

  return mapBusinessMembership(membership);
}

export async function getAccessibleApps(userId: string, organizationId?: string) {
  const memberships = await getOrganizationMemberships(userId);
  const accessibleOrganizationIds = memberships.map((entry) => entry.organization.id);
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
  const rows = await db
    .select({
      app: oauthApps,
      member: organizationIdentityMembers,
      identity: identities,
      organization: organizations,
    })
    .from(oauthApps)
    .innerJoin(organizations, eq(organizations.id, oauthApps.organizationId))
    .innerJoin(organizationIdentityMembers, and(
      eq(organizationIdentityMembers.organizationId, organizations.id),
      eq(organizationIdentityMembers.status, "active"),
    ))
    .innerJoin(identities, and(
      eq(identities.id, organizationIdentityMembers.identityId),
      eq(identities.userId, userId),
    ))
    .where(eq(oauthApps.id, appId));
  const eligible = rows
    .map((row) => ({ app: row.app, membership: mapBusinessMembership(row) }))
    .filter((row) => roleRank[row.membership.role] >= roleRank[minimumRole])
    .sort((left, right) => roleRank[right.membership.role] - roleRank[left.membership.role]);
  const accessible = eligible[0];
  if (!accessible) return null;

  return {
    app: accessible.app,
    membership: accessible.membership,
  };
}
