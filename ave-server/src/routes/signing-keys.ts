import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db, identities, signingKeys } from "../db";
import { recordActivityLog } from "../lib/background-events";
import { buildAuditPayload } from "../lib/business";
import { isValidPublicKey, verifySignature } from "../lib/signing";
import { requireAuth, requireWritable } from "../middleware/auth";

const app = new Hono();

const keySchema = z.object({
  publicKey: z.string().min(1),
  encryptedPrivateKey: z.string().min(1),
});

app.get("/keys", requireAuth, async (c) => {
  const user = c.get("user")!;
  const rows = await db
    .select({ identity: identities, signingKey: signingKeys })
    .from(identities)
    .leftJoin(signingKeys, eq(signingKeys.identityId, identities.id))
    .where(eq(identities.userId, user.id));

  return c.json({
    keys: rows.map((row) => {
      const hasSigningKey = row.signingKey ? isValidPublicKey(row.signingKey.publicKey) : false;
      return {
        identityId: row.identity.id,
        handle: row.identity.handle,
        displayName: row.identity.displayName,
        hasSigningKey,
        publicKey: hasSigningKey ? row.signingKey!.publicKey : null,
        createdAt: hasSigningKey ? row.signingKey!.createdAt : null,
      };
    }),
  });
});

app.get("/keys/:identityId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId") || "";
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);
  if (!identity) return c.json({ error: "Identity not found" }, 404);

  const [key] = await db.select().from(signingKeys).where(eq(signingKeys.identityId, identityId)).limit(1);
  if (!key || !isValidPublicKey(key.publicKey)) {
    return c.json({ hasKey: false, publicKey: null, encryptedPrivateKey: null });
  }

  return c.json({
    hasKey: true,
    publicKey: key.publicKey,
    encryptedPrivateKey: key.encryptedPrivateKey,
    createdAt: key.createdAt,
  });
});

app.post("/keys/:identityId", requireAuth, requireWritable, zValidator("json", keySchema), async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId") || "";
  const { publicKey, encryptedPrivateKey } = c.req.valid("json");
  if (!isValidPublicKey(publicKey)) return c.json({ error: "Invalid public key format" }, 400);

  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);
  if (!identity) return c.json({ error: "Identity not found" }, 404);

  const [existingKey] = await db.select().from(signingKeys).where(eq(signingKeys.identityId, identityId)).limit(1);
  if (existingKey && isValidPublicKey(existingKey.publicKey)) {
    return c.json({ error: "Signing key already exists for this identity" }, 409);
  }

  const [newKey] = existingKey
    ? await db.update(signingKeys).set({ publicKey, encryptedPrivateKey }).where(eq(signingKeys.id, existingKey.id)).returning()
    : await db.insert(signingKeys).values({ identityId, publicKey, encryptedPrivateKey }).returning();

  recordActivityLog(c, {
    userId: user.id,
    action: "signing_key_created",
    details: { identityId, handle: identity.handle },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({ success: true, publicKey: newKey.publicKey, createdAt: newKey.createdAt });
});

app.put("/keys/:identityId", requireAuth, requireWritable, zValidator("json", keySchema.extend({ rotationSignature: z.string().min(1).max(2000) })), async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId") || "";
  const { publicKey, encryptedPrivateKey, rotationSignature } = c.req.valid("json");
  if (!isValidPublicKey(publicKey)) return c.json({ error: "Invalid public key format" }, 400);

  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);
  if (!identity) return c.json({ error: "Identity not found" }, 404);

  const [existingKey] = await db.select().from(signingKeys).where(eq(signingKeys.identityId, identityId)).limit(1);
  if (!existingKey) return c.json({ error: "Signing key not found" }, 404);
  const payload = buildAuditPayload("signing_key.rotated", { identityId, publicKey, encryptedPrivateKey });
  if (!await verifySignature(payload, rotationSignature, existingKey.publicKey)) {
    return c.json({ error: "A signature from the current signing key is required" }, 403);
  }
  const [newKey] = await db.update(signingKeys)
    .set({ publicKey, encryptedPrivateKey, createdAt: new Date() })
    .where(and(eq(signingKeys.id, existingKey.id), eq(signingKeys.publicKey, existingKey.publicKey)))
    .returning();
  if (!newKey) return c.json({ error: "Signing key changed during rotation" }, 409);
  recordActivityLog(c, {
    userId: user.id,
    action: "signing_key_rotated",
    details: { identityId, handle: identity.handle },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });

  return c.json({ success: true, publicKey: newKey.publicKey, createdAt: newKey.createdAt });
});

app.get("/public-key/:handle", async (c) => {
  const handle = c.req.param("handle");
  const [result] = await db
    .select({ identity: identities, signingKey: signingKeys })
    .from(identities)
    .leftJoin(signingKeys, eq(signingKeys.identityId, identities.id))
    .where(eq(identities.handle, handle))
    .limit(1);
  if (!result) return c.json({ error: "Identity not found" }, 404);
  if (!result.signingKey || !isValidPublicKey(result.signingKey.publicKey)) {
    return c.json({ error: "No signing key for this identity" }, 404);
  }
  return c.json({
    handle: result.identity.handle,
    publicKey: result.signingKey.publicKey,
    createdAt: result.signingKey.createdAt,
  });
});

export default app;
