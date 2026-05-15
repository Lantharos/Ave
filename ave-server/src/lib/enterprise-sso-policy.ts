import { and, eq } from "drizzle-orm";
import { db, organizations, organizationSsoConnections } from "../db";

export async function getRequiredEnterpriseSsoForEmail(email: string | null | undefined) {
  const domain = email?.split("@").pop()?.toLowerCase();
  if (!domain) return null;

  const [row] = await db
    .select({ connection: organizationSsoConnections, organization: organizations })
    .from(organizationSsoConnections)
    .innerJoin(organizations, eq(organizations.id, organizationSsoConnections.organizationId))
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
    .select()
    .from(organizationSsoConnections)
    .where(and(
      eq(organizationSsoConnections.organizationId, organization.id),
      eq(organizationSsoConnections.status, "active"),
    ))
    .limit(1);

  if (!connection) return null;
  return {
    loginUrl: `/api/business/sso/${connection.type}/${connection.id}/start`,
    organization: { id: organization.id, name: organization.name },
    connection,
  };
}
