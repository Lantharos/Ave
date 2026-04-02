import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  activityLogs,
  db,
  identities,
  identityEncryptionKeys,
  oauthApps,
  sharedSecretAccess,
  sharedSecrets,
  sharedSecretTransferContracts,
} from "../db";
import type { Context, Next } from "hono";
import { requireAuth, type AuthUser } from "../middleware/auth";
import { generateSessionToken, hashSessionToken } from "../lib/crypto";
import {
  resolveOAuthAccessFromBearer,
  oauthTokenAllowsAppScopedSecret,
  oauthTokenMatchesAppScopedPayload,
  oauthQueryAppIdMatchesAccessToken,
} from "../lib/oauth-access-auth";

const app = new Hono();

function getPublicWebBase(): string {
  return process.env.RP_ORIGIN || "http://localhost:5173";
}

function normalizeReturnUrl(value?: string | null): string | null {
  if (!value) return null;

  try {
    if (value.startsWith("/")) {
      return new URL(value, getPublicWebBase()).toString();
    }

    const parsed = new URL(value);
    if (!parsed.protocol) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function isExpired(expiresAt: Date): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

async function resolveOwnedIdentity(userId: string, identityId: string) {
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, userId)))
    .limit(1);

  return identity ?? null;
}

app.get("/transfers/:claimToken", async (c) => {
  const claimToken = c.req.param("claimToken");
  const claimTokenHash = hashSessionToken(claimToken);

  const [result] = await db
    .select({
      contract: sharedSecretTransferContracts,
      secret: sharedSecrets,
      owner: identities,
      oauthApp: oauthApps,
    })
    .from(sharedSecretTransferContracts)
    .innerJoin(sharedSecrets, eq(sharedSecrets.id, sharedSecretTransferContracts.sharedSecretId))
    .innerJoin(identities, eq(identities.id, sharedSecretTransferContracts.ownerIdentityId))
    .leftJoin(oauthApps, eq(oauthApps.id, sharedSecrets.appId))
    .where(eq(sharedSecretTransferContracts.claimTokenHash, claimTokenHash))
    .limit(1);

  if (!result) {
    return c.json({ error: "Transfer not found" }, 404);
  }

  if (isExpired(result.contract.expiresAt)) {
    if (result.contract.status !== "expired") {
      await db
        .update(sharedSecretTransferContracts)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(sharedSecretTransferContracts.id, result.contract.id));
    }

    return c.json({ error: "Transfer expired" }, 410);
  }

  return c.json({
    transfer: {
      id: result.contract.id,
      targetHandle: result.contract.targetHandle,
      status: result.contract.status,
      expiresAt: result.contract.expiresAt,
      descriptor: {
        id: result.secret.id,
        kind: result.secret.kind,
        appId: result.secret.appId,
        resourceKey: result.secret.resourceKey,
        label: result.secret.label,
        appName: result.oauthApp?.name ?? null,
      },
      returnUrl: result.contract.returnUrl,
      owner: {
        identityId: result.owner.id,
        handle: result.owner.handle,
        displayName: result.owner.displayName,
      },
    },
  });
});

async function sharedSecretsOAuthBridge(c: Context, next: Next) {
  if (c.get("user")) {
    c.set("oauthAccess", null);
    return next();
  }

  const authHeader = c.req.header("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!bearer) {
    c.set("oauthAccess", null);
    return next();
  }

  const record = await resolveOAuthAccessFromBearer(bearer);
  if (record) {
    c.set("user", {
      id: record.userId,
      deviceId: null,
      authMethod: "oauth_access_token",
    } satisfies AuthUser);
    c.set("oauthAccess", record);
  } else {
    c.set("oauthAccess", null);
  }

  return next();
}

app.use("*", sharedSecretsOAuthBridge);
app.use("*", requireAuth);

const createSharedSecretSchema = z.object({
  identityId: z.string().uuid(),
  kind: z.enum(["app_scoped", "global"]),
  appId: z.string().min(1).max(128).optional(),
  resourceKey: z.string().max(128).optional(),
  label: z.string().min(1).max(80).optional(),
  encryptedSecret: z.string().min(1),
});

app.post("/", zValidator("json", createSharedSecretSchema), async (c) => {
  const user = c.get("user")!;
  const payload = c.req.valid("json");

  const ownerIdentity = await resolveOwnedIdentity(user.id, payload.identityId);
  if (!ownerIdentity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  if (payload.kind === "app_scoped" && !payload.appId) {
    return c.json({ error: "appId is required for app_scoped secrets" }, 400);
  }

  const oauth = c.get("oauthAccess");
  if (!(await oauthTokenMatchesAppScopedPayload(oauth, payload.appId))) {
    return c.json({ error: "appId does not match access token" }, 403);
  }

  const [secret] = await db
    .insert(sharedSecrets)
    .values({
      ownerIdentityId: payload.identityId,
      kind: payload.kind,
      appId: payload.appId || null,
      resourceKey: payload.resourceKey || null,
      label: payload.label || null,
      status: "active",
    })
    .returning();

  await db.insert(sharedSecretAccess).values({
    sharedSecretId: secret.id,
    recipientIdentityId: payload.identityId,
    encryptedSecretForRecipient: payload.encryptedSecret,
    claimedAt: new Date(),
  });

  await db.insert(activityLogs).values({
    userId: user.id,
    action: "shared_secret_created",
    details: {
      sharedSecretId: secret.id,
      ownerIdentityId: payload.identityId,
      kind: payload.kind,
      appId: payload.appId,
      resourceKey: payload.resourceKey,
      label: payload.label,
    },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({
    secret: {
      id: secret.id,
      kind: secret.kind,
      appId: secret.appId,
      resourceKey: secret.resourceKey,
      label: secret.label,
      status: secret.status,
      createdAt: secret.createdAt,
    },
  }, 201);
});

app.get("/", async (c) => {
  const user = c.get("user")!;
  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, user.id));
  const identityIds = userIdentities.map((identity) => identity.id);

  if (identityIds.length === 0) {
    return c.json({ created: [], received: [] });
  }

  const createdRows = await db
    .select({
      secret: sharedSecrets,
      owner: identities,
      access: sharedSecretAccess,
      oauthApp: oauthApps,
    })
    .from(sharedSecrets)
    .innerJoin(identities, eq(identities.id, sharedSecrets.ownerIdentityId))
    .leftJoin(
      sharedSecretAccess,
      and(
        eq(sharedSecretAccess.sharedSecretId, sharedSecrets.id),
        eq(sharedSecretAccess.recipientIdentityId, sharedSecrets.ownerIdentityId),
        isNull(sharedSecretAccess.revokedAt)
      )
    )
    .leftJoin(oauthApps, eq(oauthApps.id, sharedSecrets.appId))
    .where(inArray(sharedSecrets.ownerIdentityId, identityIds))
    .orderBy(desc(sharedSecrets.createdAt));

  const oauth = c.get("oauthAccess");
  const created = createdRows.filter((row) => oauthTokenAllowsAppScopedSecret(oauth, row.secret));

  const createdTransfers = created.length === 0
    ? []
    : await db
        .select()
        .from(sharedSecretTransferContracts)
        .where(inArray(sharedSecretTransferContracts.sharedSecretId, created.map((row) => row.secret.id)))
        .orderBy(desc(sharedSecretTransferContracts.createdAt));

  const receivedRows = await db
    .select({
      access: sharedSecretAccess,
      secret: sharedSecrets,
      owner: identities,
      oauthApp: oauthApps,
    })
    .from(sharedSecretAccess)
    .innerJoin(sharedSecrets, eq(sharedSecrets.id, sharedSecretAccess.sharedSecretId))
    .innerJoin(identities, eq(identities.id, sharedSecrets.ownerIdentityId))
    .leftJoin(oauthApps, eq(oauthApps.id, sharedSecrets.appId))
    .where(and(inArray(sharedSecretAccess.recipientIdentityId, identityIds), isNull(sharedSecretAccess.revokedAt)))
    .orderBy(desc(sharedSecretAccess.createdAt));

  const received = receivedRows.filter((row) => oauthTokenAllowsAppScopedSecret(oauth, row.secret));

  return c.json({
    created: created.map((row) => ({
      id: row.secret.id,
      kind: row.secret.kind,
      appId: row.secret.appId,
      resourceKey: row.secret.resourceKey,
      label: row.secret.label,
      status: row.secret.status,
      createdAt: row.secret.createdAt,
      ownerIdentityId: row.owner.id,
      ownerHandle: row.owner.handle,
      appName: row.oauthApp?.name ?? null,
      encryptedSecret: row.access?.encryptedSecretForRecipient ?? null,
      transfers: createdTransfers
        .filter((transfer) => transfer.sharedSecretId === row.secret.id)
        .map((transfer) => ({
          id: transfer.id,
          targetHandle: transfer.targetHandle,
          status: transfer.status,
          expiresAt: transfer.expiresAt,
          createdAt: transfer.createdAt,
          claimedAt: transfer.claimedAt,
        })),
    })),
    received: received
      .filter((row) => row.access.recipientIdentityId !== row.secret.ownerIdentityId)
      .map((row) => ({
      id: row.access.id,
      sharedSecretId: row.secret.id,
      identityId: row.access.recipientIdentityId,
      encryptedSecret: row.access.encryptedSecretForRecipient,
      claimedAt: row.access.claimedAt,
      descriptor: {
        id: row.secret.id,
        kind: row.secret.kind,
        appId: row.secret.appId,
        resourceKey: row.secret.resourceKey,
        label: row.secret.label,
        appName: row.oauthApp?.name ?? null,
      },
      owner: {
        identityId: row.owner.id,
        handle: row.owner.handle,
        displayName: row.owner.displayName,
      },
    })),
  });
});

const createTransferSchema = z.object({
  identityId: z.string().uuid(),
  targetHandle: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  encryptedSecretForTarget: z.string().min(1),
  senderPublicKey: z.string().min(1),
  expiresInHours: z.number().int().min(1).max(24 * 30).optional().default(72),
  returnUrl: z.string().min(1).optional(),
});

app.post("/:id/transfers", zValidator("json", createTransferSchema), async (c) => {
  const user = c.get("user")!;
  const sharedSecretId = c.req.param("id");
  const payload = c.req.valid("json");

  const ownerIdentity = await resolveOwnedIdentity(user.id, payload.identityId);
  if (!ownerIdentity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  const [secret] = await db
    .select()
    .from(sharedSecrets)
    .where(eq(sharedSecrets.id, sharedSecretId))
    .limit(1);

  if (!secret) {
    return c.json({ error: "Shared secret not found" }, 404);
  }

  const isSecretOwner = secret.ownerIdentityId === payload.identityId;
  let canCreateTransfer = isSecretOwner;

  if (!canCreateTransfer) {
    const [recipientAccess] = await db
      .select()
      .from(sharedSecretAccess)
      .where(
        and(
          eq(sharedSecretAccess.sharedSecretId, sharedSecretId),
          eq(sharedSecretAccess.recipientIdentityId, payload.identityId),
          isNull(sharedSecretAccess.revokedAt)
        )
      )
      .limit(1);
    canCreateTransfer = !!recipientAccess;
  }

  if (!canCreateTransfer) {
    return c.json({ error: "Shared secret not found" }, 404);
  }

  const oauth = c.get("oauthAccess");
  if (!oauthTokenAllowsAppScopedSecret(oauth, secret)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const normalizedHandle = payload.targetHandle.toLowerCase();
  const [targetIdentity] = await db
    .select()
    .from(identities)
    .where(eq(identities.handle, normalizedHandle))
    .limit(1);

  if (!targetIdentity) {
    return c.json({ error: "Target handle not found" }, 404);
  }

  const [targetKey] = await db
    .select()
    .from(identityEncryptionKeys)
    .where(eq(identityEncryptionKeys.identityId, targetIdentity.id))
    .limit(1);

  if (!targetKey) {
    return c.json({ error: "Target identity does not have an encryption key yet" }, 409);
  }

  const claimToken = generateSessionToken();
  const claimTokenHash = hashSessionToken(claimToken);
  const expiresAt = new Date(Date.now() + payload.expiresInHours * 60 * 60 * 1000);
  const normalizedReturnUrl = normalizeReturnUrl(payload.returnUrl);

  if (payload.returnUrl && !normalizedReturnUrl) {
    return c.json({ error: "Invalid returnUrl" }, 400);
  }

  const [contract] = await db
    .insert(sharedSecretTransferContracts)
    .values({
      sharedSecretId,
      ownerIdentityId: payload.identityId,
      targetHandle: normalizedHandle,
      targetIdentityId: targetIdentity.id,
      claimTokenHash,
      encryptedSecretForTarget: payload.encryptedSecretForTarget,
      senderPublicKey: payload.senderPublicKey,
      returnUrl: normalizedReturnUrl,
      expiresAt,
      status: "pending",
    })
    .returning();

  await db.insert(activityLogs).values({
    userId: user.id,
    action: "shared_secret_transfer_created",
    details: {
      sharedSecretId,
      transferId: contract.id,
      targetHandle: normalizedHandle,
      senderIdentityId: payload.identityId,
      delegatedByRecipient: !isSecretOwner,
    },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  const claimUrl = `${getPublicWebBase()}/shared/claim?token=${encodeURIComponent(claimToken)}`;

  return c.json({
    transfer: {
      id: contract.id,
      targetHandle: contract.targetHandle,
      status: contract.status,
      expiresAt: contract.expiresAt,
      descriptor: {
        id: secret.id,
        kind: secret.kind,
        appId: secret.appId,
        resourceKey: secret.resourceKey,
        label: secret.label,
      },
      returnUrl: contract.returnUrl,
    },
    claimToken,
    claimUrl,
  }, 201);
});

const claimTransferSchema = z.object({
  identityId: z.string().uuid(),
});

app.post("/transfers/:claimToken/claim", zValidator("json", claimTransferSchema), async (c) => {
  const user = c.get("user")!;
  const claimToken = c.req.param("claimToken");
  const claimTokenHash = hashSessionToken(claimToken);
  const { identityId } = c.req.valid("json");

  const claimantIdentity = await resolveOwnedIdentity(user.id, identityId);
  if (!claimantIdentity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  const [result] = await db
    .select({
      contract: sharedSecretTransferContracts,
      secret: sharedSecrets,
      owner: identities,
      oauthApp: oauthApps,
    })
    .from(sharedSecretTransferContracts)
    .innerJoin(sharedSecrets, eq(sharedSecrets.id, sharedSecretTransferContracts.sharedSecretId))
    .innerJoin(identities, eq(identities.id, sharedSecretTransferContracts.ownerIdentityId))
    .leftJoin(oauthApps, eq(oauthApps.id, sharedSecrets.appId))
    .where(eq(sharedSecretTransferContracts.claimTokenHash, claimTokenHash))
    .limit(1);

  if (!result) {
    return c.json({ error: "Transfer not found" }, 404);
  }

  if (isExpired(result.contract.expiresAt) || result.contract.status === "expired") {
    return c.json({ error: "Transfer expired" }, 410);
  }

  if (claimantIdentity.handle !== result.contract.targetHandle) {
    return c.json({ error: "Logged in handle does not match transfer target" }, 403);
  }

  return c.json({
    transfer: {
      id: result.contract.id,
      sharedSecretId: result.secret.id,
      encryptedSecretForTarget: result.contract.encryptedSecretForTarget,
      senderPublicKey: result.contract.senderPublicKey,
      targetHandle: result.contract.targetHandle,
      expiresAt: result.contract.expiresAt,
      descriptor: {
        id: result.secret.id,
        kind: result.secret.kind,
        appId: result.secret.appId,
        resourceKey: result.secret.resourceKey,
        label: result.secret.label,
        appName: result.oauthApp?.name ?? null,
      },
      returnUrl: result.contract.returnUrl,
      owner: {
        identityId: result.owner.id,
        handle: result.owner.handle,
        displayName: result.owner.displayName,
      },
    },
  });
});

const finalizeRecipientSchema = z.object({
  identityId: z.string().uuid(),
  transferId: z.string().uuid(),
  encryptedSecretForRecipient: z.string().min(1),
});

app.post("/:id/finalize-recipient-storage", zValidator("json", finalizeRecipientSchema), async (c) => {
  const user = c.get("user")!;
  const sharedSecretId = c.req.param("id");
  const { identityId, transferId, encryptedSecretForRecipient } = c.req.valid("json");

  const claimantIdentity = await resolveOwnedIdentity(user.id, identityId);
  if (!claimantIdentity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  const [contract] = await db
    .select()
    .from(sharedSecretTransferContracts)
    .where(and(eq(sharedSecretTransferContracts.id, transferId), eq(sharedSecretTransferContracts.sharedSecretId, sharedSecretId)))
    .limit(1);

  if (!contract) {
    return c.json({ error: "Transfer not found" }, 404);
  }

  if (claimantIdentity.handle !== contract.targetHandle) {
    return c.json({ error: "Logged in handle does not match transfer target" }, 403);
  }

  const [existingAccess] = await db
    .select()
    .from(sharedSecretAccess)
    .where(and(eq(sharedSecretAccess.sharedSecretId, sharedSecretId), eq(sharedSecretAccess.recipientIdentityId, identityId)))
    .limit(1);

  if (existingAccess) {
    await db
      .update(sharedSecretAccess)
      .set({
        encryptedSecretForRecipient,
        claimedAt: new Date(),
        revokedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(sharedSecretAccess.id, existingAccess.id));
  } else {
    await db.insert(sharedSecretAccess).values({
      sharedSecretId,
      recipientIdentityId: identityId,
      encryptedSecretForRecipient,
      claimedAt: new Date(),
    });
  }

  await db
    .update(sharedSecretTransferContracts)
    .set({
      targetIdentityId: identityId,
      claimedAt: new Date(),
      status: "claimed",
      updatedAt: new Date(),
    })
    .where(eq(sharedSecretTransferContracts.id, transferId));

  await db.insert(activityLogs).values({
    userId: user.id,
    action: "shared_secret_claimed",
    details: {
      sharedSecretId,
      transferId,
      identityId,
      handle: claimantIdentity.handle,
    },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({ success: true });
});

app.get("/access", async (c) => {
  const user = c.get("user")!;
  const requestedKind = c.req.query("kind");
  const requestedAppId = c.req.query("appId");
  const requestedResourceKey = c.req.query("resourceKey");

  const oauth = c.get("oauthAccess");
  if (!(await oauthQueryAppIdMatchesAccessToken(oauth, requestedAppId))) {
    return c.json({ error: "appId does not match access token" }, 403);
  }

  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, user.id));
  const identityIds = userIdentities.map((identity) => identity.id);

  if (identityIds.length === 0) {
    return c.json({ access: [] });
  }

  const rows = await db
    .select({
      access: sharedSecretAccess,
      secret: sharedSecrets,
      owner: identities,
      oauthApp: oauthApps,
    })
    .from(sharedSecretAccess)
    .innerJoin(sharedSecrets, eq(sharedSecrets.id, sharedSecretAccess.sharedSecretId))
    .innerJoin(identities, eq(identities.id, sharedSecrets.ownerIdentityId))
    .leftJoin(oauthApps, eq(oauthApps.id, sharedSecrets.appId))
    .where(and(inArray(sharedSecretAccess.recipientIdentityId, identityIds), isNull(sharedSecretAccess.revokedAt)))
    .orderBy(desc(sharedSecretAccess.updatedAt));

  const filtered = rows.filter((row) => {
    if (!oauthTokenAllowsAppScopedSecret(oauth, row.secret)) return false;
    if (requestedKind && row.secret.kind !== requestedKind) return false;
    if (requestedAppId && row.secret.appId !== requestedAppId) return false;
    if (requestedResourceKey && row.secret.resourceKey !== requestedResourceKey) return false;
    return true;
  });

  return c.json({
    access: filtered.map((row) => ({
      id: row.access.id,
      sharedSecretId: row.secret.id,
      identityId: row.access.recipientIdentityId,
      encryptedSecret: row.access.encryptedSecretForRecipient,
      createdAt: row.access.createdAt,
      claimedAt: row.access.claimedAt,
      descriptor: {
        id: row.secret.id,
        kind: row.secret.kind,
        appId: row.secret.appId,
        resourceKey: row.secret.resourceKey,
        label: row.secret.label,
        appName: row.oauthApp?.name ?? null,
      },
      owner: {
        identityId: row.owner.id,
        handle: row.owner.handle,
        displayName: row.owner.displayName,
      },
    })),
  });
});

export default app;
