import { and, eq } from "drizzle-orm";
import {
  activityLogs,
  db,
  devices,
  identities,
  organizationIdentityMembers,
  organizationSsoConnections,
  sessions,
  users,
  type Organization,
  type OrganizationSsoConnection,
} from "../db";
import { clientIp, userAgent } from "./business-route-utils";
import { writeBusinessAuditEvent } from "./business";
import { generateSessionToken, hashSessionToken } from "./crypto";
import { setSessionCookie } from "./session-cookie";

function normalizeDisplayName(value: string | null | undefined, email: string) {
  const fallback = email.split("@")[0] || "SSO user";
  return (value || fallback).trim().slice(0, 64) || fallback;
}

function handlePart(value: string, fallback: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || fallback;
}

async function createUniqueSsoHandle(email: string, organization: Organization) {
  const local = handlePart(email.split("@")[0] || "", "sso");
  const org = handlePart(organization.slug || organization.name, "org");
  const base = `${local}_${org}`.slice(0, 28).replace(/_+$/g, "") || "sso_user";

  for (let counter = 0; counter < 100; counter += 1) {
    const suffix = counter ? `_${counter}` : "";
    const candidate = `${base.slice(0, 32 - suffix.length)}${suffix}`;
    const handle = candidate.length >= 3 ? candidate : `${candidate}_id`;
    const [existing] = await db.select({ id: identities.id }).from(identities).where(eq(identities.handle, handle)).limit(1);
    if (!existing) return handle;
  }

  return `sso_${crypto.randomUUID().replace(/-/g, "").slice(0, 28)}`;
}

async function resolveEnterpriseIdentity(email: string, displayName: string | null | undefined, organization: Organization) {
  const [existing] = await db.select().from(identities).where(eq(identities.email, email)).limit(1);
  if (existing) return { identity: existing, created: false };

  const [user] = await db.insert(users).values({}).returning();
  const [identity] = await db.insert(identities).values({
    userId: user.id,
    displayName: normalizeDisplayName(displayName, email),
    handle: await createUniqueSsoHandle(email, organization),
    email,
    isPrimary: true,
  }).returning();

  return { identity, created: true };
}

async function ensureOrganizationMembership(organizationId: string, identityId: string) {
  const [membership] = await db
    .select()
    .from(organizationIdentityMembers)
    .where(and(eq(organizationIdentityMembers.organizationId, organizationId), eq(organizationIdentityMembers.identityId, identityId)))
    .limit(1);

  if (!membership) {
    await db.insert(organizationIdentityMembers).values({
      organizationId,
      identityId,
      role: "member",
      scopes: ["read"],
      signingAuthority: false,
      status: "active",
    });
  } else if (membership.status !== "active") {
    await db.update(organizationIdentityMembers).set({ status: "active", updatedAt: new Date() }).where(eq(organizationIdentityMembers.id, membership.id));
  }
}

export async function completeEnterpriseSsoLogin(input: {
  c: any;
  organization: Organization;
  connection: OrganizationSsoConnection;
  email: string;
  displayName?: string | null;
}) {
  const { c, organization, connection, email } = input;
  const { identity, created } = await resolveEnterpriseIdentity(email, input.displayName, organization);
  await ensureOrganizationMembership(organization.id, identity.id);

  const [device] = await db.insert(devices).values({
    userId: identity.userId,
    name: `${organization.name} SSO`,
    type: "computer",
    browser: "Enterprise SSO",
    os: connection.provider,
  }).returning();

  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    userId: identity.userId,
    deviceId: device.id,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
    authMethod: "enterprise_sso",
    enterpriseSsoOrganizationId: organization.id,
    enterpriseSsoConnectionId: connection.id,
  });
  setSessionCookie(c, sessionToken, expiresAt);

  await db.insert(activityLogs).values({
    userId: identity.userId,
    action: created ? "account_created" : "login",
    details: { method: "enterprise_sso", organizationId: organization.id, connectionId: connection.id },
    deviceId: device.id,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
    severity: "info",
  });
  await writeBusinessAuditEvent({
    organizationId: organization.id,
    actorUserId: identity.userId,
    actorIdentityId: identity.id,
    action: "sso.login",
    details: { connectionId: connection.id, email, created },
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });
}

export async function recordSsoConnectionTest(input: {
  c: any;
  organizationId: string;
  connectionId: string;
  actorUserId: string;
  actorIdentityId: string;
  email: string;
  type: "saml" | "oidc";
}) {
  await db.update(organizationSsoConnections).set({ status: "active", updatedAt: new Date() }).where(eq(organizationSsoConnections.id, input.connectionId));
  await writeBusinessAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorIdentityId: input.actorIdentityId,
    action: "sso_connection.tested",
    details: { connectionId: input.connectionId, email: input.email, type: input.type },
    ipAddress: clientIp(input.c),
    userAgent: userAgent(input.c),
  });
}
