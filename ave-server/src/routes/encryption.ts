import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, identities, identityEncryptionKeys, activityLogs } from "../db";
import { requireAuth } from "../middleware/auth";

const app = new Hono();

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

const upsertKeySchema = z.object({
  publicKey: z.string().min(1),
  encryptedPrivateKey: z.string().min(1),
});

app.post("/keys/:identityId", zValidator("json", upsertKeySchema), async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");
  const { publicKey, encryptedPrivateKey } = c.req.valid("json");

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
    return c.json({ error: "Encryption key already exists for this identity" }, 409);
  }

  const [created] = await db
    .insert(identityEncryptionKeys)
    .values({
      identityId,
      publicKey,
      encryptedPrivateKey,
    })
    .returning();

  await db.insert(activityLogs).values({
    userId: user.id,
    action: "identity_encryption_key_created",
    details: { identityId, handle: identity.handle },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({
    success: true,
    publicKey: created.publicKey,
    createdAt: created.createdAt,
  }, 201);
});

app.put("/keys/:identityId", zValidator("json", upsertKeySchema), async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");
  const { publicKey, encryptedPrivateKey } = c.req.valid("json");

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
        publicKey,
        encryptedPrivateKey,
      })
      .where(eq(identityEncryptionKeys.id, existing.id));
  } else {
    await db
      .insert(identityEncryptionKeys)
      .values({
        identityId,
        publicKey,
        encryptedPrivateKey,
      });
  }

  await db.insert(activityLogs).values({
    userId: user.id,
    action: existing ? "identity_encryption_key_rotated" : "identity_encryption_key_created",
    details: { identityId, handle: identity.handle },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: existing ? "warning" : "info",
  });

  return c.json({ success: true });
});

export default app;
