import { and, eq, inArray } from "drizzle-orm";
import {
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
import { recordActivityLog, recordBusinessAuditEvent } from "./background-events";
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
  const candidates = Array.from({ length: 100 }, (_, counter) => {
    const suffix = counter ? `_${counter}` : "";
    const candidate = `${base.slice(0, 32 - suffix.length)}${suffix}`;
    return candidate.length >= 3 ? candidate : `${candidate}_id`;
  });
  const existingHandles = await db
    .select({ handle: identities.handle })
    .from(identities)
    .where(inArray(identities.handle, candidates));
  const occupied = new Set(existingHandles.map((identity) => identity.handle));
  const available = candidates.find((candidate) => !occupied.has(candidate));

  return available ?? `sso_${crypto.randomUUID().replace(/-/g, "").slice(0, 28)}`;
}

function isIdentityHandleUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("unique") && (
    message.includes("identities.handle")
    || message.includes("identities_handle")
  );
}

async function resolveEnterpriseIdentity(email: string, displayName: string | null | undefined, organization: Organization) {
  const [existing] = await db.select().from(identities).where(eq(identities.email, email)).limit(1);
  if (existing) return { identity: existing, created: false, createdUserId: null };

  const [user] = await db.insert(users).values({}).returning();
  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const [identity] = await db.insert(identities).values({
          userId: user.id,
          displayName: normalizeDisplayName(displayName, email),
          handle: await createUniqueSsoHandle(email, organization),
          email,
          isPrimary: true,
        }).returning();
        return { identity, created: true, createdUserId: user.id };
      } catch (error) {
        if (!isIdentityHandleUniqueViolation(error)) throw error;
      }
    }

    throw new Error("Could not allocate a unique SSO handle");
  } catch (error) {
    await db.delete(users).where(eq(users.id, user.id));
    throw error;
  }
}

async function ensureOrganizationMembership(organizationId: string, identityId: string) {
  const [membership] = await db
    .select()
    .from(organizationIdentityMembers)
    .where(and(eq(organizationIdentityMembers.organizationId, organizationId), eq(organizationIdentityMembers.identityId, identityId)))
    .limit(1);

  if (!membership) {
    try {
      await db.insert(organizationIdentityMembers).values({
        organizationId,
        identityId,
        role: "member",
        scopes: ["read"],
        signingAuthority: false,
        status: "active",
      });
    } catch (error) {
      const [concurrentMembership] = await db
        .select()
        .from(organizationIdentityMembers)
        .where(and(eq(organizationIdentityMembers.organizationId, organizationId), eq(organizationIdentityMembers.identityId, identityId)))
        .limit(1);
      if (!concurrentMembership) throw error;
      if (concurrentMembership.status !== "active") {
        await db.update(organizationIdentityMembers).set({ status: "active", updatedAt: new Date() }).where(eq(organizationIdentityMembers.id, concurrentMembership.id));
      }
    }
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
  const resolvedIdentity = await resolveEnterpriseIdentity(email, input.displayName, organization);
  const { identity, created } = resolvedIdentity;
  try {
    await ensureOrganizationMembership(organization.id, identity.id);
  } catch (error) {
    if (resolvedIdentity.createdUserId) {
      await db.delete(users).where(eq(users.id, resolvedIdentity.createdUserId));
    }
    throw error;
  }

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

  recordActivityLog(c, {
    userId: identity.userId,
    action: created ? "account_created" : "login",
    details: { method: "enterprise_sso", organizationId: organization.id, connectionId: connection.id },
    deviceId: device.id,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
    severity: "info",
  });
  recordBusinessAuditEvent(c, {
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
  recordBusinessAuditEvent(input.c, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorIdentityId: input.actorIdentityId,
    action: "sso_connection.tested",
    details: { connectionId: input.connectionId, email: input.email, type: input.type },
    ipAddress: clientIp(input.c),
    userAgent: userAgent(input.c),
  });
}
