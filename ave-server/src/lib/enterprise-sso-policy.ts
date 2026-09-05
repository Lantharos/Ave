import { and, eq, isNotNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db, organizationDomainVerifications, organizations, organizationSsoConnections, type OrganizationSsoConnection } from "../db";

const verifiedConnectionDomain = and(
  eq(organizationDomainVerifications.organizationId, organizationSsoConnections.organizationId),
  eq(organizationDomainVerifications.domain, organizationSsoConnections.domain),
  eq(organizationDomainVerifications.status, "verified"),
  isNotNull(organizationDomainVerifications.verifiedAt),
);

export async function hasVerifiedOrganizationDomain(organizationId: string, domain: string | null) {
  if (!domain) return false;
  const [verification] = await db.select({ id: organizationDomainVerifications.id })
    .from(organizationDomainVerifications)
    .where(and(
      eq(organizationDomainVerifications.organizationId, organizationId),
      eq(organizationDomainVerifications.domain, domain),
      eq(organizationDomainVerifications.status, "verified"),
      isNotNull(organizationDomainVerifications.verifiedAt),
    ))
    .limit(1);
  return Boolean(verification);
}

export async function requireVerifiedSsoDomain(connection: OrganizationSsoConnection): Promise<string> {
  if (!connection.domain || !await hasVerifiedOrganizationDomain(connection.organizationId, connection.domain)) {
    throw new HTTPException(403, { message: "SSO requires a DNS-verified organization domain" });
  }
  return connection.domain;
}

export async function requireVerifiedSsoEmail(connection: OrganizationSsoConnection, email: string): Promise<string> {
  const domain = await requireVerifiedSsoDomain(connection);
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.split("@")[1] !== domain) {
    throw new HTTPException(403, { message: "SSO email domain is not allowed for this organization" });
  }
  return normalizedEmail;
}

export async function getRequiredEnterpriseSsoForEmail(email: string | null | undefined) {
  const domain = email?.split("@").pop()?.toLowerCase();
  if (!domain) return null;

  const [row] = await db
    .select({ connection: organizationSsoConnections, organization: organizations })
    .from(organizationSsoConnections)
    .innerJoin(organizations, eq(organizations.id, organizationSsoConnections.organizationId))
    .innerJoin(organizationDomainVerifications, verifiedConnectionDomain)
    .where(and(
      eq(organizationSsoConnections.domain, domain),
      eq(organizationSsoConnections.status, "active"),
      eq(organizations.ssoRequired, true),
    ))
    .limit(1);

  if (!row) return null;
  return {
    loginUrl: `/api/business/sso/${row.connection.type}/${row.connection.id}/start`,
    organization: { id: row.organization.id, name: row.organization.name },
    connection: row.connection,
  };
}

export async function getRequiredEnterpriseSsoForOrganization(organization: Pick<typeof organizations.$inferSelect, "id" | "name" | "ssoRequired">) {
  if (!organization.ssoRequired) return null;

  const [connection] = await db
    .select({ connection: organizationSsoConnections })
    .from(organizationSsoConnections)
    .innerJoin(organizationDomainVerifications, verifiedConnectionDomain)
    .where(and(
      eq(organizationSsoConnections.organizationId, organization.id),
      eq(organizationSsoConnections.status, "active"),
    ))
    .limit(1);

  if (!connection) return null;
  const verifiedConnection = connection.connection;
  return {
    loginUrl: `/api/business/sso/${verifiedConnection.type}/${verifiedConnection.id}/start`,
    organization: { id: organization.id, name: organization.name },
    connection: verifiedConnection,
  };
}
