import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  activityLogs,
  db,
  identities,
  signingKeys,
} from "../db";
import { validateOpaqueKeyEnvelope, validatePublicKeyBlob } from "../lib/encryption-key-payload";
import { requireAuth, requireWritableForMutation } from "../middleware/auth";

const app = new Hono();

const postKeySchema = z
  .object({
    publicKey: z.string().min(1),
    encryptedPrivateKey: z.string().min(1),
  });

const putKeySchema = postKeySchema;

app.get("/public-key/:handle", async (c) => {
  const handle = c.req.param("handle").toLowerCase();

  const [result] = await db
    .select({
      identity: identities,
      key: signingKeys,
    })
    .from(identities)
    .leftJoin(signingKeys, eq(signingKeys.identityId, identities.id))
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
    .from(signingKeys)
    .where(eq(signingKeys.identityId, identityId))
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
    .from(signingKeys)
    .where(eq(signingKeys.identityId, identityId))
    .limit(1);

  if (existing) {
    return c.json({ error: "Identity key already exists for this identity" }, 409);
  }

  const [created] = await db
    .insert(signingKeys)
    .values({
      identityId,
      publicKey: body.publicKey,
      encryptedPrivateKey: body.encryptedPrivateKey,
    })
    .returning();

  await db.insert(activityLogs).values({
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
    .from(signingKeys)
    .where(eq(signingKeys.identityId, identityId))
    .limit(1);

  if (existing) {
    await db
      .update(signingKeys)
      .set({
        publicKey: body.publicKey,
        encryptedPrivateKey: body.encryptedPrivateKey,
      })
      .where(eq(signingKeys.id, existing.id));
  } else {
    await db.insert(signingKeys).values({
      identityId,
      publicKey: body.publicKey,
      encryptedPrivateKey: body.encryptedPrivateKey,
    });
  }

  await db.insert(activityLogs).values({
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
