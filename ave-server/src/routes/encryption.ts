import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  activityLogs,
  db,
  identities,
  identityEncryptionKeys,
  identityEncryptionOauthWraps,
  oauthApps,
} from "../db";
import { validateOpaqueKeyEnvelope, validatePublicKeyBlob } from "../lib/encryption-key-payload";
import { requireAuth } from "../middleware/auth";

const app = new Hono();

const wrapModeSchema = z.enum(["master", "oauth_app_key"]);
const deviceKeySchema = z
  .string()
  .max(64)
  .regex(/^[a-zA-Z0-9._-]+$/)
  .optional();

const postKeySchema = z
  .object({
    publicKey: z.string().min(1),
    encryptedPrivateKey: z.string().min(1),
    wrap_mode: wrapModeSchema.optional(),
    oauth_app_id: z.string().uuid().optional(),
    device_key: deviceKeySchema,
  })
  .superRefine((data, ctx) => {
    const mode = data.wrap_mode ?? "master";
    if (mode === "oauth_app_key" && !data.oauth_app_id) {
      ctx.addIssue({
        code: "custom",
        message: "oauth_app_id is required when wrap_mode is oauth_app_key",
        path: ["oauth_app_id"],
      });
    }
    if (mode === "master" && data.oauth_app_id) {
      ctx.addIssue({
        code: "custom",
        message: "oauth_app_id is only valid when wrap_mode is oauth_app_key",
        path: ["oauth_app_id"],
      });
    }
    if (mode === "master" && data.device_key) {
      ctx.addIssue({
        code: "custom",
        message: "device_key is only valid when wrap_mode is oauth_app_key",
        path: ["device_key"],
      });
    }
  });

const putKeySchema = postKeySchema;

function effectiveWrapMode(row: { wrapMode: string | null } | undefined): "master" | "oauth_app_key" {
  if (!row) return "master";
  if (row.wrapMode === "oauth_app_key") return "oauth_app_key";
  return "master";
}

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

  const wraps = key
    ? await db
        .select({
          oauthAppId: identityEncryptionOauthWraps.oauthAppId,
          deviceKey: identityEncryptionOauthWraps.deviceKey,
          encryptedPrivateKey: identityEncryptionOauthWraps.encryptedPrivateKey,
          createdAt: identityEncryptionOauthWraps.createdAt,
        })
        .from(identityEncryptionOauthWraps)
        .where(eq(identityEncryptionOauthWraps.identityId, identityId))
    : [];

  return c.json({
    hasKey: !!key,
    publicKey: key?.publicKey ?? null,
    encryptedPrivateKey: key?.encryptedPrivateKey ?? null,
    wrapMode: key ? effectiveWrapMode(key) : null,
    oauthAppId: key?.oauthAppId ?? null,
    oauthWraps: wraps,
    createdAt: key?.createdAt ?? null,
  });
});

app.post("/keys/:identityId", zValidator("json", postKeySchema), async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");
  const body = c.req.valid("json");
  const wrapMode = body.wrap_mode ?? "master";
  const deviceKey = body.device_key ?? "default";

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

  if (wrapMode === "master") {
    if (existing) {
      return c.json({ error: "Encryption key already exists for this identity" }, 409);
    }

    const [created] = await db
      .insert(identityEncryptionKeys)
      .values({
        identityId,
        publicKey: body.publicKey,
        encryptedPrivateKey: body.encryptedPrivateKey,
        wrapMode: "master",
        oauthAppId: null,
      })
      .returning();

    await db.insert(activityLogs).values({
      userId: user.id,
      action: "identity_encryption_key_created",
      details: { identityId, handle: identity.handle, wrapMode: "master" },
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
        wrapMode: "master",
      },
      201
    );
  }

  const oauthAppId = body.oauth_app_id!;
  const [oauthApp] = await db.select().from(oauthApps).where(eq(oauthApps.id, oauthAppId)).limit(1);
  if (!oauthApp) {
    return c.json({ error: "OAuth app not found" }, 400);
  }

  if (!existing) {
    const [created] = await db
      .insert(identityEncryptionKeys)
      .values({
        identityId,
        publicKey: body.publicKey,
        encryptedPrivateKey: body.encryptedPrivateKey,
        wrapMode: "oauth_app_key",
        oauthAppId,
      })
      .returning();

    await db.insert(activityLogs).values({
      userId: user.id,
      action: "identity_encryption_key_created",
      details: { identityId, handle: identity.handle, wrapMode: "oauth_app_key", oauthAppId },
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
        wrapMode: "oauth_app_key",
        oauthAppId,
      },
      201
    );
  }

  if (body.publicKey !== existing.publicKey) {
    return c.json(
      { error: "publicKey must match the existing identity encryption key when adding an OAuth wrap" },
      400
    );
  }

  const primaryMode = effectiveWrapMode(existing);

  if (primaryMode === "master") {
    const [prior] = await db
      .select()
      .from(identityEncryptionOauthWraps)
      .where(
        and(
          eq(identityEncryptionOauthWraps.identityId, identityId),
          eq(identityEncryptionOauthWraps.oauthAppId, oauthAppId),
          eq(identityEncryptionOauthWraps.deviceKey, deviceKey)
        )
      )
      .limit(1);

    if (prior) {
      await db
        .update(identityEncryptionOauthWraps)
        .set({
          encryptedPrivateKey: body.encryptedPrivateKey,
          createdAt: new Date(),
        })
        .where(eq(identityEncryptionOauthWraps.id, prior.id));
    } else {
      await db.insert(identityEncryptionOauthWraps).values({
        identityId,
        oauthAppId,
        deviceKey,
        encryptedPrivateKey: body.encryptedPrivateKey,
      });
    }

    await db.insert(activityLogs).values({
      userId: user.id,
      action: "identity_encryption_oauth_wrap_upserted",
      details: { identityId, handle: identity.handle, oauthAppId, deviceKey },
      deviceId: user.deviceId,
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      severity: "info",
    });

    return c.json(
      {
        success: true,
        publicKey: existing.publicKey,
        createdAt: existing.createdAt,
        wrapMode: "oauth_wrap_added",
        oauthAppId,
        deviceKey,
      },
      201
    );
  }

  if (existing.oauthAppId === oauthAppId && deviceKey === "default") {
    await db
      .update(identityEncryptionKeys)
      .set({
        encryptedPrivateKey: body.encryptedPrivateKey,
      })
      .where(eq(identityEncryptionKeys.id, existing.id));

    await db.insert(activityLogs).values({
      userId: user.id,
      action: "identity_encryption_key_updated",
      details: { identityId, handle: identity.handle, wrapMode: "oauth_app_key", oauthAppId },
      deviceId: user.deviceId,
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      severity: "info",
    });

    return c.json({
      success: true,
      publicKey: existing.publicKey,
      createdAt: existing.createdAt,
      wrapMode: "oauth_app_key",
      oauthAppId,
      deviceKey: "default",
    });
  }

  const [sidePrior] = await db
    .select()
    .from(identityEncryptionOauthWraps)
    .where(
      and(
        eq(identityEncryptionOauthWraps.identityId, identityId),
        eq(identityEncryptionOauthWraps.oauthAppId, oauthAppId),
        eq(identityEncryptionOauthWraps.deviceKey, deviceKey)
      )
    )
    .limit(1);

  if (sidePrior) {
    await db
      .update(identityEncryptionOauthWraps)
      .set({
        encryptedPrivateKey: body.encryptedPrivateKey,
        createdAt: new Date(),
      })
      .where(eq(identityEncryptionOauthWraps.id, sidePrior.id));
  } else {
    await db.insert(identityEncryptionOauthWraps).values({
      identityId,
      oauthAppId,
      deviceKey,
      encryptedPrivateKey: body.encryptedPrivateKey,
    });
  }

  await db.insert(activityLogs).values({
    userId: user.id,
    action: "identity_encryption_oauth_wrap_upserted",
    details: { identityId, handle: identity.handle, oauthAppId, deviceKey },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({
    success: true,
    publicKey: existing.publicKey,
    createdAt: existing.createdAt,
    wrapMode: "oauth_wrap_added",
    oauthAppId,
    deviceKey,
  });
});

app.put("/keys/:identityId", zValidator("json", putKeySchema), async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");
  const body = c.req.valid("json");
  const wrapMode = body.wrap_mode ?? "master";

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

  if (wrapMode === "oauth_app_key") {
    const oauthAppId = body.oauth_app_id!;
    const [oauthApp] = await db.select().from(oauthApps).where(eq(oauthApps.id, oauthAppId)).limit(1);
    if (!oauthApp) {
      return c.json({ error: "OAuth app not found" }, 400);
    }
    const deviceKey = body.device_key ?? "default";

    if (!existing) {
      await db.insert(identityEncryptionKeys).values({
        identityId,
        publicKey: body.publicKey,
        encryptedPrivateKey: body.encryptedPrivateKey,
        wrapMode: "oauth_app_key",
        oauthAppId,
      });
    } else if (effectiveWrapMode(existing) === "oauth_app_key" && existing.oauthAppId === oauthAppId && deviceKey === "default") {
      await db
        .update(identityEncryptionKeys)
        .set({
          publicKey: body.publicKey,
          encryptedPrivateKey: body.encryptedPrivateKey,
        })
        .where(eq(identityEncryptionKeys.id, existing.id));
    } else if (existing) {
      const [side] = await db
        .select()
        .from(identityEncryptionOauthWraps)
        .where(
          and(
            eq(identityEncryptionOauthWraps.identityId, identityId),
            eq(identityEncryptionOauthWraps.oauthAppId, oauthAppId),
            eq(identityEncryptionOauthWraps.deviceKey, deviceKey)
          )
        )
        .limit(1);

      if (side) {
        await db
          .update(identityEncryptionOauthWraps)
          .set({
            encryptedPrivateKey: body.encryptedPrivateKey,
            createdAt: new Date(),
          })
          .where(eq(identityEncryptionOauthWraps.id, side.id));
      } else {
        if (body.publicKey !== existing.publicKey) {
          return c.json(
            { error: "publicKey must match the existing identity encryption key when updating an OAuth wrap" },
            400
          );
        }
        await db.insert(identityEncryptionOauthWraps).values({
          identityId,
          oauthAppId,
          deviceKey,
          encryptedPrivateKey: body.encryptedPrivateKey,
        });
      }
    }

    await db.insert(activityLogs).values({
      userId: user.id,
      action: existing ? "identity_encryption_key_rotated" : "identity_encryption_key_created",
      details: { identityId, handle: identity.handle, wrapMode: "oauth_app_key", oauthAppId, deviceKey },
      deviceId: user.deviceId,
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      severity: existing ? "warning" : "info",
    });

    return c.json({ success: true });
  }

  if (body.oauth_app_id || body.device_key) {
    return c.json({ error: "oauth fields are only valid when wrap_mode is oauth_app_key" }, 400);
  }

  if (existing) {
    await db
      .update(identityEncryptionKeys)
      .set({
        publicKey: body.publicKey,
        encryptedPrivateKey: body.encryptedPrivateKey,
        wrapMode: "master",
        oauthAppId: null,
      })
      .where(eq(identityEncryptionKeys.id, existing.id));
  } else {
    await db.insert(identityEncryptionKeys).values({
      identityId,
      publicKey: body.publicKey,
      encryptedPrivateKey: body.encryptedPrivateKey,
      wrapMode: "master",
      oauthAppId: null,
    });
  }

  await db.insert(activityLogs).values({
    userId: user.id,
    action: existing ? "identity_encryption_key_rotated" : "identity_encryption_key_created",
    details: { identityId, handle: identity.handle, wrapMode: "master" },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: existing ? "warning" : "info",
  });

  return c.json({ success: true });
});

export default app;
