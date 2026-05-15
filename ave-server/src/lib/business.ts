import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  identityEncryptionKeys,
  identities,
  organizationAuditEvents,
  organizationIdentityMembers,
  organizations,
  signingKeys,
} from "../db";
import { verifySignature } from "./signing";
import type { AuthUser } from "../middleware/auth";

export type BusinessRole = "owner" | "admin" | "signer" | "member" | "viewer";
export type BusinessScope =
  | "read"
  | "sign"
  | "approve"
  | "manage_identities"
  | "manage_keys"
  | "manage_sso"
  | "manage_org";

export const businessScopes: BusinessScope[] = [
  "read",
  "sign",
  "approve",
  "manage_identities",
  "manage_keys",
  "manage_sso",
  "manage_org",
];

const roleRank: Record<BusinessRole, number> = {
  owner: 5,
  admin: 4,
  signer: 3,
  member: 2,
  viewer: 1,
};

const defaultScopesByRole: Record<BusinessRole, BusinessScope[]> = {
  owner: ["read", "sign", "approve", "manage_identities", "manage_keys", "manage_sso", "manage_org"],
  admin: ["read", "sign", "approve", "manage_identities", "manage_keys", "manage_sso"],
  signer: ["read", "sign", "approve"],
  member: ["read"],
  viewer: ["read"],
};

export function scopesForRole(role: BusinessRole, scopes?: string[] | null): BusinessScope[] {
  const allowed = new Set(businessScopes);
  const normalized = (scopes?.length ? scopes : defaultScopesByRole[role])
    .filter((scope): scope is BusinessScope => allowed.has(scope as BusinessScope));
  return [...new Set<BusinessScope>(normalized.length ? normalized : ["read"])];
}

export function hasBusinessScope(member: Pick<typeof organizationIdentityMembers.$inferSelect, "role" | "scopes">, scope: BusinessScope) {
  if ((member.role as BusinessRole) === "owner") return true;
  return scopesForRole(member.role as BusinessRole, member.scopes as string[] | null).includes(scope);
}

export function canManageRole(actorRole: BusinessRole, targetRole: BusinessRole): boolean {
  if (actorRole === "owner") return true;
  return roleRank[actorRole] > roleRank[targetRole] && targetRole !== "owner";
}

export function hasEnterpriseSsoSessionForOrganization(user: Pick<AuthUser, "authMethod" | "enterpriseSsoOrganizationId">, organizationId: string) {
  return user.authMethod === "enterprise_sso" && user.enterpriseSsoOrganizationId === organizationId;
}

export function hasBusinessBreakGlassAccess(member: Pick<typeof organizationIdentityMembers.$inferSelect, "role" | "signingAuthority">) {
  return member.role === "owner" && member.signingAuthority;
}

export function shouldRequireEnterpriseSsoForBusinessAccess(
  user: Pick<AuthUser, "authMethod" | "enterpriseSsoOrganizationId">,
  access: {
    member: Pick<typeof organizationIdentityMembers.$inferSelect, "role" | "signingAuthority">;
    organization: Pick<typeof organizations.$inferSelect, "id" | "ssoRequired">;
  },
) {
  if (!access.organization.ssoRequired) return false;
  if (hasEnterpriseSsoSessionForOrganization(user, access.organization.id)) return false;
  return !hasBusinessBreakGlassAccess(access.member);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "organization";
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

export async function getUserBusinessIdentities(userId: string) {
  return db
    .select()
    .from(identities)
    .where(eq(identities.userId, userId));
}

export async function createBusinessOrganization(userId: string, name: string, ownerIdentityId: string) {
  const [ownerIdentity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, ownerIdentityId), eq(identities.userId, userId)))
    .limit(1);

  if (!ownerIdentity) return null;

  const [organization] = await db
    .insert(organizations)
    .values({
      name,
      slug: await createUniqueSlug(name),
      ownerUserId: userId,
      verifiedDomains: [],
      ssoRequired: false,
      appLimit: 12,
      plan: "business",
    })
    .returning();

  const [member] = await db
    .insert(organizationIdentityMembers)
    .values({
      organizationId: organization.id,
      identityId: ownerIdentity.id,
      addedByUserId: userId,
      addedByIdentityId: ownerIdentity.id,
      role: "owner",
      scopes: scopesForRole("owner"),
      signingAuthority: true,
      status: "active",
    })
    .returning();

  return { organization, member, identity: ownerIdentity };
}

export async function requireBusinessAccess(userId: string, organizationId: string, minimumRole: BusinessRole = "viewer") {
  const userIdentities = await getUserBusinessIdentities(userId);
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

  const eligible = memberships
    .filter((entry) => roleRank[entry.member.role as BusinessRole] >= roleRank[minimumRole])
    .sort((a, b) => roleRank[b.member.role as BusinessRole] - roleRank[a.member.role as BusinessRole]);

  return eligible[0] ?? null;
}

export async function listBusinessOrganizationsForUser(userId: string) {
  const userIdentities = await getUserBusinessIdentities(userId);
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
    .where(and(inArray(organizationIdentityMembers.identityId, identityIds), eq(organizationIdentityMembers.status, "active")))
    .orderBy(desc(organizationIdentityMembers.updatedAt));

  const byOrganization = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const existing = byOrganization.get(row.organization.id);
    if (!existing || roleRank[row.member.role as BusinessRole] > roleRank[existing.member.role as BusinessRole]) {
      byOrganization.set(row.organization.id, row);
    }
  }

  return [...byOrganization.values()];
}

export function serializeBusinessMember(row: {
  member: typeof organizationIdentityMembers.$inferSelect;
  identity: typeof identities.$inferSelect;
  key?: typeof identityEncryptionKeys.$inferSelect | null;
}) {
  const role = row.member.role as BusinessRole;
  return {
    id: row.member.id,
    identityId: row.identity.id,
    handle: row.identity.handle,
    displayName: row.identity.displayName,
    email: row.identity.email,
    avatarUrl: row.identity.avatarUrl,
    role,
    scopes: scopesForRole(role, row.member.scopes as string[] | null),
    signingAuthority: row.member.signingAuthority,
    status: row.member.status,
    publicKey: row.key?.publicKey ?? null,
    hasEncryptionKey: Boolean(row.key?.publicKey),
    joinedAt: row.member.createdAt,
  };
}

export function buildAuditPayload(action: string, details: Record<string, unknown>) {
  return JSON.stringify({ version: 1, action, details });
}

export async function verifySignedBusinessAction(input: {
  actorIdentityId: string;
  payload: string;
  signature?: string;
}) {
  if (!input.signature) {
    return { status: "not_provided" as const, publicKey: null };
  }

  const [key] = await db
    .select()
    .from(signingKeys)
    .where(eq(signingKeys.identityId, input.actorIdentityId))
    .limit(1);

  if (!key) return { status: "missing_key" as const, publicKey: null };

  const valid = await verifySignature(input.payload, input.signature, key.publicKey);
  return {
    status: valid ? "verified" as const : "invalid" as const,
    publicKey: valid ? key.publicKey : null,
  };
}

export async function writeBusinessAuditEvent(input: {
  organizationId: string;
  actorUserId?: string | null;
  actorIdentityId?: string | null;
  targetIdentityId?: string | null;
  action: string;
  details: Record<string, unknown>;
  signature?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity?: "info" | "warning" | "danger";
}) {
  const payload = buildAuditPayload(input.action, input.details);
  const verification = input.actorIdentityId
    ? await verifySignedBusinessAction({
        actorIdentityId: input.actorIdentityId,
        payload,
        signature: input.signature,
      })
    : { status: "not_provided" as const, publicKey: null };

  await db.insert(organizationAuditEvents).values({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorIdentityId: input.actorIdentityId,
    targetIdentityId: input.targetIdentityId,
    action: input.action,
    details: input.details,
    signaturePayload: payload,
    signature: verification.status === "verified" ? input.signature : null,
    signaturePublicKey: verification.publicKey,
    signatureStatus: verification.status,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    severity: input.severity || "info",
  });

  return verification.status;
}
