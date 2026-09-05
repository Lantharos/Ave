import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db, identities, oauthApps, organizationIdentityMembers, organizations } from "../db";
import type { AuthUser } from "../middleware/auth";
import {
  createBusinessOrganization,
  getUserBusinessIdentities,
  hasBusinessScope,
  listBusinessOrganizationsForUser,
  requireBusinessAccess,
  shouldRequireEnterpriseSsoForBusinessAccess,
  type BusinessRole,
} from "./business";
import { getRequiredEnterpriseSsoForOrganization } from "./enterprise-sso-policy";

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

export async function enforcePortalOrganizationAccess(
  user: AuthUser,
  access: Pick<BusinessMembership, "member" | "organization">,
  minimumRole: OrganizationRole = "viewer",
) {
  if (!hasBusinessScope(access.member, "read")) {
    throw new HTTPException(403, { message: "Organization read access required" });
  }
  if (shouldRequireEnterpriseSsoForBusinessAccess(user, access)) {
    const policy = await getRequiredEnterpriseSsoForOrganization(access.organization);
    throw new HTTPException(403, {
      res: Response.json({
        error: "enterprise_sso_required",
        loginUrl: policy?.loginUrl,
        organization: { id: access.organization.id, name: access.organization.name },
      }, { status: 403 }),
    });
  }
  if (minimumRole !== "viewer" && !access.member.signingAuthority) {
    throw new HTTPException(403, { message: "Signing authority required" });
  }
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

  return mapBusinessMembership(created);
}

export async function getOrganizationMemberships(userId: string) {
  const memberships = await listOrganizationMemberships(userId);
  if (memberships.length) return memberships;
  return [await createPersonalOrganization(userId)];
}

export async function requireOrganizationAccess(user: AuthUser, organizationId: string, minimumRole: OrganizationRole = "viewer") {
  const membership = await requireBusinessAccess(user.id, organizationId, businessRoleForOrganizationRole(minimumRole));
  if (!membership) return null;

  await enforcePortalOrganizationAccess(user, membership, minimumRole);
  return mapBusinessMembership(membership);
}

export async function getAccessibleApps(user: AuthUser, organizationId?: string) {
  const memberships = await getOrganizationMemberships(user.id);
  const membership = organizationId
    ? memberships.find((entry) => entry.organization.id === organizationId)
    : memberships[0];
  if (!membership) return [];
  await enforcePortalOrganizationAccess(user, membership);
  return db.select().from(oauthApps)
    .where(eq(oauthApps.organizationId, membership.organization.id));
}

export async function getAccessibleApp(user: AuthUser, appId: string, minimumRole: OrganizationRole = "viewer") {
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
      eq(identities.userId, user.id),
    ))
    .where(eq(oauthApps.id, appId));
  const eligible = rows
    .map((row) => ({ app: row.app, membership: mapBusinessMembership(row) }))
    .filter((row) => roleRank[row.membership.role] >= roleRank[minimumRole])
    .sort((left, right) => roleRank[right.membership.role] - roleRank[left.membership.role]);
  const accessible = eligible[0];
  if (!accessible) return null;
  await enforcePortalOrganizationAccess(user, accessible.membership, minimumRole);

  return {
    app: accessible.app,
    membership: accessible.membership,
  };
}
