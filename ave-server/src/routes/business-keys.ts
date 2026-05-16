import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  db,
  organizationEncryptionPolicies,
  organizationIdentityMembers,
  organizationKeyGrants,
  organizationKeyrings,
} from "../db";
import {
  buildAuditPayload,
  hasBusinessScope,
  requireBusinessAccess,
  shouldRequireEnterpriseSsoForBusinessAccess,
  verifySignedBusinessAction,
} from "../lib/business";
import {
  kmsProviders,
  normalizeKmsKeyRef,
  organizationEncryptionModes,
  serializeEncryptionPolicy,
  type KmsProvider,
  type OrganizationEncryptionMode,
} from "../lib/business-encryption";
import { clientIp, userAgent } from "../lib/business-route-utils";
import { validateOpaqueKeyEnvelope, validatePublicKeyBlob } from "../lib/encryption-key-payload";
import { getRequiredEnterpriseSsoForOrganization } from "../lib/enterprise-sso-policy";
import { recordBusinessAuditEvent } from "../lib/background-events";
import { requireAuth, requireWritableForMutation } from "../middleware/auth";

const app = new Hono();

const signedActionSchema = z.object({ signature: z.string().min(1).max(2000) }).optional();
const encryptionModeSchema = z.enum(organizationEncryptionModes as [OrganizationEncryptionMode, ...OrganizationEncryptionMode[]]);
const kmsProviderSchema = z.enum(kmsProviders as [KmsProvider, ...KmsProvider[]]);
const grantSchema = z.object({
  identityId: z.string().uuid(),
  encryptedKey: z.string().min(1),
  senderPublicKey: z.string().min(1),
  recipientPublicKey: z.string().min(1),
});

app.use("/organizations/*", requireAuth);
app.use("/organizations/*", requireWritableForMutation);

async function requireSignedAction(c: any, actorIdentityId: string, action: string, details: Record<string, unknown>, signature?: string) {
  if (!signature) return c.json({ error: "Action signature required" }, 400);
  const result = await verifySignedBusinessAction({
    actorIdentityId,
    payload: buildAuditPayload(action, details),
    signature,
  });
  if (result.status === "verified") return null;
  if (result.status === "missing_key") return c.json({ error: "Acting identity needs a signing key" }, 400);
  return c.json({ error: "Invalid action signature" }, 400);
}

function rejectWithoutSigningAuthority(c: any, member: { signingAuthority: boolean }) {
  if (member.signingAuthority) return null;
  return c.json({ error: "Signing authority required" }, 403);
}

async function rejectWithoutRequiredSso(c: any, access: NonNullable<Awaited<ReturnType<typeof requireBusinessAccess>>>) {
  const user = c.get("user")!;
  if (!shouldRequireEnterpriseSsoForBusinessAccess(user, access)) return null;
  const policy = await getRequiredEnterpriseSsoForOrganization(access.organization);
  return c.json({
    error: "enterprise_sso_required",
    loginUrl: policy?.loginUrl,
    organization: { id: access.organization.id, name: access.organization.name },
  }, 403);
}

async function requireKeyAccess(c: any, organizationId: string) {
  const user = c.get("user")!;
  const access = await requireBusinessAccess(user.id, organizationId, "admin");
  if (!access || !hasBusinessScope(access.member, "manage_keys")) return { error: c.json({ error: "Organization not found" }, 404) };
  const ssoError = await rejectWithoutRequiredSso(c, access);
  if (ssoError) return { error: ssoError };
  const authorityError = rejectWithoutSigningAuthority(c, access.member);
  if (authorityError) return { error: authorityError };
  return { access, user };
}

async function encryptionPolicyForOrganization(organizationId: string) {
  const [policy] = await db
    .select()
    .from(organizationEncryptionPolicies)
    .where(eq(organizationEncryptionPolicies.organizationId, organizationId))
    .limit(1);
  return policy ?? null;
}

async function validateGrantTargets(organizationId: string, grants: z.infer<typeof grantSchema>[]) {
  for (const grant of grants) {
    const encrypted = validateOpaqueKeyEnvelope(grant.encryptedKey);
    const sender = validatePublicKeyBlob(grant.senderPublicKey);
    const recipient = validatePublicKeyBlob(grant.recipientPublicKey);
    if (!encrypted.ok) return encrypted.error;
    if (!sender.ok) return sender.error;
    if (!recipient.ok) return recipient.error;
  }

  const targetMembers = await db.select().from(organizationIdentityMembers)
    .where(and(eq(organizationIdentityMembers.organizationId, organizationId), eq(organizationIdentityMembers.status, "active")));
  const activeIdentityIds = new Set(targetMembers.map((member) => member.identityId));
  return grants.some((grant) => !activeIdentityIds.has(grant.identityId))
    ? "Key grants can only target active organization identities"
    : null;
}

function keyProviderRefForMode(mode: OrganizationEncryptionMode, policy: ReturnType<typeof serializeEncryptionPolicy>) {
  if (mode === "enterprise_managed") return policy.kmsKeyRef;
  if (mode === "standard") return "ave-standard";
  return null;
}

app.patch("/organizations/:organizationId/encryption-policy", zValidator("json", z.object({
  mode: encryptionModeSchema,
  kmsProvider: kmsProviderSchema.optional(),
  kmsKeyRef: z.string().max(800).optional(),
  kmsKeyVersion: z.string().max(200).optional(),
  signedAction: signedActionSchema,
})), async (c) => {
  const organizationId = c.req.param("organizationId");
  const body = c.req.valid("json");
  const result = await requireKeyAccess(c, organizationId);
  if (result.error) return result.error;
  const access = result.access!;
  const user = result.user!;

  const current = await encryptionPolicyForOrganization(organizationId);
  const nextProvider = body.mode === "enterprise_managed" ? body.kmsProvider ?? current?.kmsProvider : null;
  const nextKeyRef = body.mode === "enterprise_managed" ? body.kmsKeyRef ?? current?.kmsKeyRef ?? "" : null;
  if (body.mode === "enterprise_managed") {
    if (!nextProvider || !kmsProviders.includes(nextProvider as KmsProvider)) return c.json({ error: "KMS provider is required" }, 400);
    const normalized = normalizeKmsKeyRef(nextProvider as KmsProvider, nextKeyRef || "");
    if (!normalized.ok) return c.json({ error: normalized.error }, 400);
  }

  const auditDetails = {
    mode: body.mode,
    kmsProvider: nextProvider,
    kmsKeyRef: nextKeyRef,
    kmsKeyVersion: body.mode === "enterprise_managed" ? body.kmsKeyVersion ?? current?.kmsKeyVersion ?? null : null,
  };
  const signatureError = await requireSignedAction(c, access.identity.id, "encryption_policy.updated", auditDetails, body.signedAction?.signature);
  if (signatureError) return signatureError;

  const [policy] = await db.insert(organizationEncryptionPolicies).values({
    organizationId,
    mode: body.mode,
    status: "active",
    kmsProvider: nextProvider,
    kmsKeyRef: nextKeyRef,
    kmsKeyVersion: body.mode === "enterprise_managed" ? body.kmsKeyVersion ?? current?.kmsKeyVersion ?? null : null,
    requireIdentityKeys: body.mode === "e2ee",
    rotatedAt: new Date(),
  }).onConflictDoUpdate({
    target: organizationEncryptionPolicies.organizationId,
    set: {
      mode: body.mode,
      status: "active",
      kmsProvider: nextProvider,
      kmsKeyRef: nextKeyRef,
      kmsKeyVersion: body.mode === "enterprise_managed" ? body.kmsKeyVersion ?? current?.kmsKeyVersion ?? null : null,
      requireIdentityKeys: body.mode === "e2ee",
      rotatedAt: new Date(),
      updatedAt: new Date(),
    },
  }).returning();

  recordBusinessAuditEvent(c, {
    organizationId,
    actorUserId: user.id,
    actorIdentityId: access.identity.id,
    action: "encryption_policy.updated",
    details: auditDetails,
    signature: body.signedAction?.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });

  return c.json({ encryptionPolicy: serializeEncryptionPolicy(policy, organizationId) });
});

app.post("/organizations/:organizationId/keys", zValidator("json", z.object({
  name: z.string().min(2).max(80),
  resource: z.string().min(2).max(120).optional(),
  encryptionMode: encryptionModeSchema.optional(),
  grants: z.array(grantSchema).max(100).optional(),
  signedAction: signedActionSchema,
})), async (c) => {
  const organizationId = c.req.param("organizationId");
  const body = c.req.valid("json");
  const result = await requireKeyAccess(c, organizationId);
  if (result.error) return result.error;
  const access = result.access!;
  const user = result.user!;

  const policy = serializeEncryptionPolicy(await encryptionPolicyForOrganization(organizationId), organizationId);
  const mode = body.encryptionMode ?? policy.mode;
  const grants = body.grants ?? [];
  if (mode === "e2ee" && !grants.length) return c.json({ error: "E2EE org keys require identity-wrapped grants" }, 400);
  if (mode === "enterprise_managed" && (!policy.kmsProvider || !policy.kmsKeyRef)) return c.json({ error: "Configure a KMS key before creating enterprise-managed org keys" }, 400);
  const grantError = grants.length ? await validateGrantTargets(organizationId, grants) : null;
  if (grantError) return c.json({ error: grantError }, 400);

  const keyProviderRef = keyProviderRefForMode(mode, policy);
  const auditDetails = { name: body.name, resource: body.resource, mode, grants: grants.length, keyProviderRef };
  const signatureError = await requireSignedAction(c, access.identity.id, "key.created", auditDetails, body.signedAction?.signature);
  if (signatureError) return signatureError;

  const [keyring] = await db.insert(organizationKeyrings).values({
    organizationId,
    name: body.name,
    resource: body.resource,
    encryptionMode: mode,
    epoch: 1,
    keyProviderRef,
    createdByUserId: user.id,
    createdByIdentityId: access.identity.id,
    status: "active",
  }).returning();

  if (grants.length) {
    await db.insert(organizationKeyGrants).values(grants.map((grant) => ({
      organizationId,
      keyringId: keyring.id,
      identityId: grant.identityId,
      encryptedKey: grant.encryptedKey,
      senderPublicKey: grant.senderPublicKey,
      recipientPublicKey: grant.recipientPublicKey,
      status: "active",
    })));
  }

  recordBusinessAuditEvent(c, {
    organizationId,
    actorUserId: user.id,
    actorIdentityId: access.identity.id,
    action: "key.created",
    details: auditDetails,
    signature: body.signedAction?.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
  });

  return c.json({ key: { id: keyring.id, name: keyring.name, resource: keyring.resource, encryptionMode: mode, epoch: keyring.epoch, grantCount: grants.length } }, 201);
});

app.post("/organizations/:organizationId/keys/:keyringId/rotate", zValidator("json", z.object({
  grants: z.array(grantSchema).max(100).optional(),
  signedAction: signedActionSchema,
})), async (c) => {
  const { organizationId, keyringId } = c.req.param();
  const body = c.req.valid("json");
  const result = await requireKeyAccess(c, organizationId);
  if (result.error) return result.error;
  const access = result.access!;
  const user = result.user!;

  const [keyring] = await db.select().from(organizationKeyrings)
    .where(and(eq(organizationKeyrings.id, keyringId), eq(organizationKeyrings.organizationId, organizationId)))
    .limit(1);
  if (!keyring) return c.json({ error: "Org key not found" }, 404);

  const mode = keyring.encryptionMode as OrganizationEncryptionMode;
  const grants = body.grants ?? [];
  if (mode === "e2ee" && !grants.length) return c.json({ error: "E2EE rotation requires identity-wrapped grants" }, 400);
  const grantError = grants.length ? await validateGrantTargets(organizationId, grants) : null;
  if (grantError) return c.json({ error: grantError }, 400);

  const nextEpoch = keyring.epoch + 1;
  const auditDetails = { keyringId, mode, nextEpoch, grants: grants.length, keyProviderRef: keyring.keyProviderRef };
  const signatureError = await requireSignedAction(c, access.identity.id, "key.rotated", auditDetails, body.signedAction?.signature);
  if (signatureError) return signatureError;

  await db.update(organizationKeyrings)
    .set({ status: "rotated", updatedAt: new Date() })
    .where(eq(organizationKeyrings.id, keyring.id));
  await db.update(organizationKeyGrants)
    .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(organizationKeyGrants.keyringId, keyring.id), eq(organizationKeyGrants.status, "active")));

  const [next] = await db.insert(organizationKeyrings).values({
    organizationId,
    name: keyring.name,
    resource: keyring.resource,
    encryptionMode: mode,
    epoch: nextEpoch,
    rotatedFromKeyringId: keyring.id,
    keyProviderRef: keyring.keyProviderRef,
    createdByUserId: user.id,
    createdByIdentityId: access.identity.id,
    status: "active",
  }).returning();

  if (grants.length) {
    await db.insert(organizationKeyGrants).values(grants.map((grant) => ({
      organizationId,
      keyringId: next.id,
      identityId: grant.identityId,
      encryptedKey: grant.encryptedKey,
      senderPublicKey: grant.senderPublicKey,
      recipientPublicKey: grant.recipientPublicKey,
      status: "active",
    })));
  }

  recordBusinessAuditEvent(c, {
    organizationId,
    actorUserId: user.id,
    actorIdentityId: access.identity.id,
    action: "key.rotated",
    details: auditDetails,
    signature: body.signedAction?.signature,
    ipAddress: clientIp(c),
    userAgent: userAgent(c),
    severity: "warning",
  });

  return c.json({ key: { id: next.id, name: next.name, resource: next.resource, encryptionMode: mode, epoch: next.epoch, grantCount: grants.length } }, 201);
});

export default app;
