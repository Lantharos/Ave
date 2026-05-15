import { desc, eq } from "drizzle-orm";
import {
  db,
  identityEncryptionKeys,
  organizationEncryptionPolicies,
  identities,
  organizationAuditEvents,
  organizationDomainVerifications,
  organizationIdentityMembers,
  organizationKeyGrants,
  organizationKeyrings,
  organizationSsoConnections,
} from "../db";
import { serializeBusinessMember } from "./business";
import { serializeEncryptionPolicy } from "./business-encryption";
import { serializeSsoConnection } from "./sso-metadata";

export function clientIp(c: any) {
  return c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || null;
}

export function userAgent(c: any) {
  return c.req.header("user-agent") || null;
}

export function verificationToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `ave-domain-verification=${Buffer.from(bytes).toString("base64url")}`;
}

function hasTxtToken(answer: unknown, token: string) {
  if (!answer || typeof answer !== "object" || !("Answer" in answer) || !Array.isArray((answer as any).Answer)) {
    return false;
  }
  return (answer as any).Answer.some((entry: any) => {
    const data = typeof entry?.data === "string" ? entry.data.replace(/^"|"$/g, "").replace(/"\s+"/g, "") : "";
    return data === token;
  });
}

export async function verifyDnsTxt(domain: string, token: string) {
  const response = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(`_ave-challenge.${domain}`)}&type=TXT`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!response.ok) return false;
  return hasTxtToken(await response.json(), token);
}

export async function getOrganizationBundle(organizationId: string) {
  const [memberRows, keys, grants, encryptionPolicies, ssoConnections, domains, auditEvents] = await Promise.all([
    db
      .select({ member: organizationIdentityMembers, identity: identities, key: identityEncryptionKeys })
      .from(organizationIdentityMembers)
      .innerJoin(identities, eq(identities.id, organizationIdentityMembers.identityId))
      .leftJoin(identityEncryptionKeys, eq(identityEncryptionKeys.identityId, organizationIdentityMembers.identityId))
      .where(eq(organizationIdentityMembers.organizationId, organizationId))
      .orderBy(desc(organizationIdentityMembers.createdAt)),
    db.select().from(organizationKeyrings).where(eq(organizationKeyrings.organizationId, organizationId)),
    db.select().from(organizationKeyGrants).where(eq(organizationKeyGrants.organizationId, organizationId)),
    db.select().from(organizationEncryptionPolicies).where(eq(organizationEncryptionPolicies.organizationId, organizationId)).limit(1),
    db.select().from(organizationSsoConnections).where(eq(organizationSsoConnections.organizationId, organizationId)),
    db.select().from(organizationDomainVerifications).where(eq(organizationDomainVerifications.organizationId, organizationId)),
    db
      .select()
      .from(organizationAuditEvents)
      .where(eq(organizationAuditEvents.organizationId, organizationId))
      .orderBy(desc(organizationAuditEvents.createdAt))
      .limit(50),
  ]);

  const grantsByKey = new Map<string, typeof grants>();
  for (const grant of grants) {
    const list = grantsByKey.get(grant.keyringId) || [];
    list.push(grant);
    grantsByKey.set(grant.keyringId, list);
  }

  return {
    members: memberRows.map(serializeBusinessMember),
    keys: keys.map((key) => ({
      id: key.id,
      name: key.name,
      resource: key.resource,
      status: key.status,
      encryptionMode: key.encryptionMode,
      epoch: key.epoch,
      rotatedFromKeyringId: key.rotatedFromKeyringId,
      keyProviderRef: key.keyProviderRef,
      createdByIdentityId: key.createdByIdentityId,
      grants: (grantsByKey.get(key.id) || []).map((grant) => ({
        id: grant.id,
        identityId: grant.identityId,
        status: grant.status,
        wrapVersion: grant.wrapVersion,
        revokedAt: grant.revokedAt,
        createdAt: grant.createdAt,
      })),
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    })),
    encryptionPolicy: serializeEncryptionPolicy(encryptionPolicies[0] ?? null, organizationId),
    ssoConnections: ssoConnections.map(serializeSsoConnection),
    domains: domains.map((domain) => ({
      id: domain.id,
      domain: domain.domain,
      token: domain.token,
      status: domain.status,
      verifiedAt: domain.verifiedAt,
      createdAt: domain.createdAt,
    })),
    auditEvents,
  };
}
