import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  db,
  identityEncryptionKeys,
  identities,
  oauthApps,
  oauthAuthorizations,
} from "../db";
import { validateOpaqueKeyEnvelope, validatePublicKeyBlob } from "../lib/encryption-key-payload";
import { requireAuth, requireWritableForMutation } from "../middleware/auth";
import { recordActivityLog } from "../lib/background-events";
import { enforceRateLimits, ipRateLimit } from "../lib/rate-limit";

const app = new Hono();

const appLookupQuerySchema = z.object({
  client_id: z.string().min(1),
  handle: z.string().min(1).optional(),
  public_key: z.string().min(1).optional(),
}).refine((value) => {
  const hasHandle = !!value.handle?.trim();
  const hasPublicKey = !!value.public_key?.trim();
  return hasHandle !== hasPublicKey;
}, {
  message: "Provide exactly one of handle or public_key",
});

const postKeySchema = z
  .object({
    publicKey: z.string().min(1),
    encryptedPrivateKey: z.string().min(1),
  });

const putKeySchema = postKeySchema;

app.get("/app-lookup", zValidator("query", appLookupQuerySchema), async (c) => {
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "encryption:app-lookup:ip", 240, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  const { client_id: clientId, handle, public_key: publicKey } = c.req.valid("query");

  const [oauthApp] = await db
    .select({ id: oauthApps.id, clientId: oauthApps.clientId })
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);

  if (!oauthApp) {
    return c.json({ error: "App not found" }, 404);
  }

  if (handle) {
    const normalizedHandle = handle.toLowerCase();
    const [identity] = await db
      .select()
      .from(identities)
      .where(eq(identities.handle, normalizedHandle))
      .limit(1);

    if (!identity) {
      return c.json({ error: "Identity not found" }, 404);
    }

    const [authorization] = await db
      .select()
      .from(oauthAuthorizations)
      .where(and(
        eq(oauthAuthorizations.identityId, identity.id),
        eq(oauthAuthorizations.appId, oauthApp.id),
      ))
      .limit(1);

    if (!authorization) {
      return c.json({ error: "User has not signed in to this app" }, 404);
    }

    if (!authorization.appPublicKey) {
      return c.json({ error: "User has not provisioned an app encryption public key" }, 404);
    }

    return c.json({
      clientId: oauthApp.clientId,
      identityId: identity.id,
      handle: identity.handle,
      displayName: identity.displayName,
      publicKey: authorization.appPublicKey,
      encryptionMode: authorization.appEncryptionMode || "asymmetric",
    });
  }

  const pk = validatePublicKeyBlob(publicKey!);
  if (!pk.ok) {
    return c.json({ error: pk.error }, 400);
  }

  const [result] = await db
    .select({
      identity: identities,
      authorization: oauthAuthorizations,
    })
    .from(oauthAuthorizations)
    .innerJoin(identities, eq(identities.id, oauthAuthorizations.identityId))
    .where(and(
      eq(oauthAuthorizations.appId, oauthApp.id),
      eq(oauthAuthorizations.appPublicKey, publicKey!),
    ))
    .limit(1);

  if (!result) {
    return c.json({ error: "No user found for this app public key" }, 404);
  }

  if (!result.authorization.appPublicKey) {
    return c.json({ error: "User has not provisioned an app encryption public key" }, 404);
  }

  return c.json({
    clientId: oauthApp.clientId,
    identityId: result.identity.id,
    handle: result.identity.handle,
    displayName: result.identity.displayName,
    publicKey: result.authorization.appPublicKey,
    encryptionMode: result.authorization.appEncryptionMode || "asymmetric",
  });
});

app.get("/public-key/:handle", async (c) => {
  const handle = c.req.param("handle").toLowerCase();

  const [result] = await db
    .select({
      identity: identities,
      key: identityEncryptionKeys,
    })
    .from(identities)
    .leftJoin(identityEncryptionKeys, eq(identityEncryptionKeys.identityId, identities.id))
    .where(eq(identities.handle, handle))
    .limit(1);

  if (!result) {
    return c.json({ error: "Identity not found" }, 404);
  }

  if (!result.key) {
    return c.json({ error: "No encryption key for this identity" }, 404);
  }

  return c.json({
    identityId: result.identity.id,
    handle: result.identity.handle,
    publicKey: result.key.publicKey,
    createdAt: result.key.createdAt,
  });
});

app.use("/keys/*", requireAuth);
app.use("/keys/*", requireWritableForMutation);

app.get("/keys/:identityId", async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");

  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);

  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  const [key] = await db
    .select()
    .from(identityEncryptionKeys)
    .where(eq(identityEncryptionKeys.identityId, identityId))
    .limit(1);

  return c.json({
    hasKey: !!key,
    publicKey: key?.publicKey ?? null,
    encryptedPrivateKey: key?.encryptedPrivateKey ?? null,
    createdAt: key?.createdAt ?? null,
  });
});

app.post("/keys/:identityId", zValidator("json", postKeySchema), async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");
  const body = c.req.valid("json");

  const pk = validatePublicKeyBlob(body.publicKey);
  if (!pk.ok) {
    return c.json({ error: pk.error }, 400);
  }
  const enc = validateOpaqueKeyEnvelope(body.encryptedPrivateKey);
  if (!enc.ok) {
    return c.json({ error: enc.error }, 400);
  }

  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);

  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  const [existing] = await db
    .select()
    .from(identityEncryptionKeys)
    .where(eq(identityEncryptionKeys.identityId, identityId))
    .limit(1);

  if (existing) {
    return c.json({ error: "Identity key already exists for this identity" }, 409);
  }

  const [created] = await db
    .insert(identityEncryptionKeys)
    .values({
      identityId,
      publicKey: body.publicKey,
      encryptedPrivateKey: body.encryptedPrivateKey,
    })
    .returning();

  recordActivityLog(c, {
    userId: user.id,
    action: "identity_key_created",
    details: { identityId, handle: identity.handle },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json(
    {
      success: true,
      publicKey: created.publicKey,
      createdAt: created.createdAt,
    },
    201
  );
});

app.put("/keys/:identityId", zValidator("json", putKeySchema), async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");
  const body = c.req.valid("json");

  const pk = validatePublicKeyBlob(body.publicKey);
  if (!pk.ok) {
    return c.json({ error: pk.error }, 400);
  }
  const enc = validateOpaqueKeyEnvelope(body.encryptedPrivateKey);
  if (!enc.ok) {
    return c.json({ error: enc.error }, 400);
  }

  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);

  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  const [existing] = await db
    .select()
    .from(identityEncryptionKeys)
    .where(eq(identityEncryptionKeys.identityId, identityId))
    .limit(1);

  if (existing) {
    await db
      .update(identityEncryptionKeys)
      .set({
        publicKey: body.publicKey,
        encryptedPrivateKey: body.encryptedPrivateKey,
      })
      .where(eq(identityEncryptionKeys.id, existing.id));
  } else {
    await db.insert(identityEncryptionKeys).values({
      identityId,
      publicKey: body.publicKey,
      encryptedPrivateKey: body.encryptedPrivateKey,
    });
  }

  recordActivityLog(c, {
    userId: user.id,
    action: existing ? "identity_key_rotated" : "identity_key_created",
    details: { identityId, handle: identity.handle },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: existing ? "warning" : "info",
  });

  return c.json({ success: true });
});

export default app;
