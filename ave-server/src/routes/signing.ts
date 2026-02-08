import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, signingKeys, signatureRequests, identities, oauthApps, activityLogs } from "../db";
import { requireAuth } from "../middleware/auth";
import { eq, and, desc } from "drizzle-orm";
import { verifySignature, isValidPublicKey, isValidSignature } from "../lib/signing";
import { verifyJwt, getResourceAudience } from "../lib/oidc";
import { hashSessionToken } from "../lib/crypto";
import { timingSafeEqual } from "crypto";

const app = new Hono();

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ============================================
// Authenticated user endpoints (manage keys)
// ============================================

// Get signing key for an identity (or all identities)
app.get("/keys", requireAuth, async (c) => {
  const user = c.get("user")!;
  
  // Get all identities for this user with their signing keys
  const userIdentities = await db
    .select({
      identity: identities,
      signingKey: signingKeys,
    })
    .from(identities)
    .leftJoin(signingKeys, eq(signingKeys.identityId, identities.id))
    .where(eq(identities.userId, user.id));
  
  return c.json({
    keys: userIdentities.map((row) => ({
      identityId: row.identity.id,
      handle: row.identity.handle,
      displayName: row.identity.displayName,
      hasSigningKey: !!row.signingKey,
      publicKey: row.signingKey?.publicKey || null,
      createdAt: row.signingKey?.createdAt || null,
    })),
  });
});

// Get signing key for a specific identity
app.get("/keys/:identityId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");
  
  // Verify identity belongs to user
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }
  
  // Get signing key
  const [key] = await db
    .select()
    .from(signingKeys)
    .where(eq(signingKeys.identityId, identityId))
    .limit(1);
  
  if (!key) {
    return c.json({ 
      hasKey: false,
      publicKey: null,
      encryptedPrivateKey: null,
    });
  }
  
  return c.json({
    hasKey: true,
    publicKey: key.publicKey,
    encryptedPrivateKey: key.encryptedPrivateKey,
    createdAt: key.createdAt,
  });
});

// Store signing key for an identity (generated client-side)
app.post("/keys/:identityId", requireAuth, zValidator("json", z.object({
  publicKey: z.string().min(1),
  encryptedPrivateKey: z.string().min(1),
})), async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");
  const { publicKey, encryptedPrivateKey } = c.req.valid("json");
  
  // Validate public key format
  if (!isValidPublicKey(publicKey)) {
    return c.json({ error: "Invalid public key format" }, 400);
  }
  
  // Verify identity belongs to user
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }
  
  // Check if key already exists
  const [existingKey] = await db
    .select()
    .from(signingKeys)
    .where(eq(signingKeys.identityId, identityId))
    .limit(1);
  
  if (existingKey) {
    return c.json({ error: "Signing key already exists for this identity" }, 409);
  }
  
  // Store the key
  const [newKey] = await db
    .insert(signingKeys)
    .values({
      identityId,
      publicKey,
      encryptedPrivateKey,
    })
    .returning();
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "signing_key_created",
    details: { identityId, handle: identity.handle },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });
  
  return c.json({
    success: true,
    publicKey: newKey.publicKey,
    createdAt: newKey.createdAt,
  });
});

// Rotate signing key (replace with new one)
app.put("/keys/:identityId", requireAuth, zValidator("json", z.object({
  publicKey: z.string().min(1),
  encryptedPrivateKey: z.string().min(1),
})), async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");
  const { publicKey, encryptedPrivateKey } = c.req.valid("json");
  
  // Validate public key format
  if (!isValidPublicKey(publicKey)) {
    return c.json({ error: "Invalid public key format" }, 400);
  }
  
  // Verify identity belongs to user
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }
  
  // Upsert the key
  await db
    .delete(signingKeys)
    .where(eq(signingKeys.identityId, identityId));
  
  const [newKey] = await db
    .insert(signingKeys)
    .values({
      identityId,
      publicKey,
      encryptedPrivateKey,
    })
    .returning();
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "signing_key_rotated",
    details: { identityId, handle: identity.handle },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });
  
  return c.json({
    success: true,
    publicKey: newKey.publicKey,
    createdAt: newKey.createdAt,
  });
});

// ============================================
// Signature request endpoints
// ============================================

// Get pending signature requests for user
app.get("/requests", requireAuth, async (c) => {
  const user = c.get("user")!;
  
  // Get user's identities
  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, user.id));
  
  const identityIds = userIdentities.map((i) => i.id);
  
  if (identityIds.length === 0) {
    return c.json({ requests: [] });
  }
  
  // Get pending requests for any of user's identities
  const requests = await db
    .select({
      request: signatureRequests,
      app: oauthApps,
      identity: identities,
    })
    .from(signatureRequests)
    .innerJoin(oauthApps, eq(oauthApps.id, signatureRequests.appId))
    .innerJoin(identities, eq(identities.id, signatureRequests.identityId))
    .where(eq(signatureRequests.status, "pending"))
    .orderBy(desc(signatureRequests.createdAt));
  
  // Filter to user's identities
  const userRequests = requests.filter((r) => identityIds.includes(r.identity.id));
  
  return c.json({
    requests: userRequests.map((r) => ({
      id: r.request.id,
      payload: r.request.payload,
      metadata: r.request.metadata,
      createdAt: r.request.createdAt,
      expiresAt: r.request.expiresAt,
      app: {
        id: r.app.id,
        name: r.app.name,
        iconUrl: r.app.iconUrl,
        websiteUrl: r.app.websiteUrl,
      },
      identity: {
        id: r.identity.id,
        handle: r.identity.handle,
        displayName: r.identity.displayName,
        avatarUrl: r.identity.avatarUrl,
      },
    })),
  });
});

// Get a specific signature request
app.get("/requests/:requestId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const requestId = c.req.param("requestId");
  
  const [result] = await db
    .select({
      request: signatureRequests,
      app: oauthApps,
      identity: identities,
      signingKey: signingKeys,
    })
    .from(signatureRequests)
    .innerJoin(oauthApps, eq(oauthApps.id, signatureRequests.appId))
    .innerJoin(identities, eq(identities.id, signatureRequests.identityId))
    .leftJoin(signingKeys, eq(signingKeys.identityId, signatureRequests.identityId))
    .where(eq(signatureRequests.id, requestId))
    .limit(1);
  
  if (!result) {
    return c.json({ error: "Request not found" }, 404);
  }
  
  // Verify this request is for one of user's identities
  if (result.identity.userId !== user.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }
  
  return c.json({
    request: {
      id: result.request.id,
      payload: result.request.payload,
      metadata: result.request.metadata,
      status: result.request.status,
      createdAt: result.request.createdAt,
      expiresAt: result.request.expiresAt,
      signature: result.request.signature,
      resolvedAt: result.request.resolvedAt,
    },
    app: {
      id: result.app.id,
      name: result.app.name,
      iconUrl: result.app.iconUrl,
      websiteUrl: result.app.websiteUrl,
    },
    identity: {
      id: result.identity.id,
      handle: result.identity.handle,
      displayName: result.identity.displayName,
      avatarUrl: result.identity.avatarUrl,
    },
    signingKey: result.signingKey ? {
      publicKey: result.signingKey.publicKey,
      encryptedPrivateKey: result.signingKey.encryptedPrivateKey,
    } : null,
  });
});

// Sign a request (submit signature from client)
app.post("/requests/:requestId/sign", requireAuth, zValidator("json", z.object({
  signature: z.string().min(1),
})), async (c) => {
  const user = c.get("user")!;
  const requestId = c.req.param("requestId");
  const { signature } = c.req.valid("json");
  
  // Validate signature format
  if (!isValidSignature(signature)) {
    return c.json({ error: "Invalid signature format" }, 400);
  }
  
  // Get the request with identity and signing key
  const [result] = await db
    .select({
      request: signatureRequests,
      identity: identities,
      signingKey: signingKeys,
    })
    .from(signatureRequests)
    .innerJoin(identities, eq(identities.id, signatureRequests.identityId))
    .leftJoin(signingKeys, eq(signingKeys.identityId, signatureRequests.identityId))
    .where(eq(signatureRequests.id, requestId))
    .limit(1);
  
  if (!result) {
    return c.json({ error: "Request not found" }, 404);
  }
  
  // Verify this request is for one of user's identities
  if (result.identity.userId !== user.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }
  
  if (result.request.status !== "pending") {
    return c.json({ error: "Request already resolved" }, 400);
  }
  
  if (new Date() > result.request.expiresAt) {
    return c.json({ error: "Request expired" }, 400);
  }
  
  if (!result.signingKey) {
    return c.json({ error: "No signing key for this identity" }, 400);
  }
  
  // Verify the signature is valid
  const isValid = await verifySignature(
    result.request.payload,
    signature,
    result.signingKey.publicKey
  );
  
  if (!isValid) {
    return c.json({ error: "Invalid signature" }, 400);
  }
  
  // Update the request
  await db
    .update(signatureRequests)
    .set({
      status: "signed",
      signature,
      resolvedAt: new Date(),
      deviceId: user.deviceId,
    })
    .where(eq(signatureRequests.id, requestId));
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "signature_created",
    details: { 
      requestId,
      identityId: result.identity.id,
      handle: result.identity.handle,
    },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });
  
  return c.json({ success: true, signature });
});

// Deny a signature request
app.post("/requests/:requestId/deny", requireAuth, async (c) => {
  const user = c.get("user")!;
  const requestId = c.req.param("requestId");
  
  // Get the request
  const [result] = await db
    .select({
      request: signatureRequests,
      identity: identities,
    })
    .from(signatureRequests)
    .innerJoin(identities, eq(identities.id, signatureRequests.identityId))
    .where(eq(signatureRequests.id, requestId))
    .limit(1);
  
  if (!result) {
    return c.json({ error: "Request not found" }, 404);
  }
  
  // Verify this request is for one of user's identities
  if (result.identity.userId !== user.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }
  
  if (result.request.status !== "pending") {
    return c.json({ error: "Request already resolved" }, 400);
  }
  
  // Update the request
  await db
    .update(signatureRequests)
    .set({
      status: "denied",
      resolvedAt: new Date(),
      deviceId: user.deviceId,
    })
    .where(eq(signatureRequests.id, requestId));
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "signature_denied",
    details: { 
      requestId,
      identityId: result.identity.id,
      handle: result.identity.handle,
    },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });
  
  return c.json({ success: true });
});

// ============================================
// Public / App endpoints
// ============================================

// Get public key for an identity (by handle) - public endpoint
app.get("/public-key/:handle", async (c) => {
  const handle = c.req.param("handle");
  
  const [result] = await db
    .select({
      identity: identities,
      signingKey: signingKeys,
    })
    .from(identities)
    .leftJoin(signingKeys, eq(signingKeys.identityId, identities.id))
    .where(eq(identities.handle, handle))
    .limit(1);
  
  if (!result) {
    return c.json({ error: "Identity not found" }, 404);
  }
  
  if (!result.signingKey) {
    return c.json({ error: "No signing key for this identity" }, 404);
  }
  
  return c.json({
    handle: result.identity.handle,
    publicKey: result.signingKey.publicKey,
    createdAt: result.signingKey.createdAt,
  });
});

// Create a signature request (from an OAuth app)
app.post("/request", zValidator("json", z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  identityId: z.string().uuid(),
  payload: z.string().min(1).max(10000), // Max 10KB payload
  metadata: z.record(z.unknown()).optional(),
  expiresInSeconds: z.number().min(60).max(3600).default(300), // 5 min default, max 1 hour
})), async (c) => {
  const { clientId, clientSecret, identityId, payload, metadata, expiresInSeconds } = c.req.valid("json");
  
  // Verify app credentials
  const [app] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);
  
  if (!app) {
    return c.json({ error: "Invalid client_id" }, 401);
  }
  
  const expectedHash = app.clientSecretHash;
  const providedHash = hashSessionToken(clientSecret);

  if (!expectedHash || !timingSafeEqualString(providedHash, expectedHash)) {
    return c.json({ error: "Invalid client_secret" }, 401);
  }
  
  // Verify identity exists and has a signing key
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.id, identityId))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }
  
  const [signingKey] = await db
    .select()
    .from(signingKeys)
    .where(eq(signingKeys.identityId, identityId))
    .limit(1);
  
  if (!signingKey) {
    return c.json({ error: "Identity does not have a signing key" }, 400);
  }
  
  // Create the request
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  
  const [request] = await db
    .insert(signatureRequests)
    .values({
      identityId,
      appId: app.id,
      payload,
      metadata: metadata || {},
      expiresAt,
    })
    .returning();
  
  return c.json({
    requestId: request.id,
    expiresAt: request.expiresAt,
    publicKey: signingKey.publicKey,
  });
});

// Poll for signature request status (from an OAuth app)
app.get("/request/:requestId/status", zValidator("query", z.object({
  clientId: z.string().min(1),
})), async (c) => {
  const requestId = c.req.param("requestId");
  const { clientId } = c.req.valid("query");
  
  const [result] = await db
    .select({
      request: signatureRequests,
      app: oauthApps,
    })
    .from(signatureRequests)
    .innerJoin(oauthApps, eq(oauthApps.id, signatureRequests.appId))
    .where(eq(signatureRequests.id, requestId))
    .limit(1);
  
  if (!result) {
    return c.json({ error: "Request not found" }, 404);
  }
  
  // Verify this request belongs to the requesting app
  if (result.app.clientId !== clientId) {
    return c.json({ error: "Unauthorized" }, 403);
  }
  
  // Check if expired
  if (result.request.status === "pending" && new Date() > result.request.expiresAt) {
    // Mark as expired
    await db
      .update(signatureRequests)
      .set({ status: "expired", resolvedAt: new Date() })
      .where(eq(signatureRequests.id, requestId));
    
    return c.json({
      status: "expired",
      signature: null,
    });
  }
  
  return c.json({
    status: result.request.status,
    signature: result.request.signature,
    resolvedAt: result.request.resolvedAt,
  });
});

// Verify a signature (public endpoint)
app.post("/verify", zValidator("json", z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
  publicKey: z.string().min(1),
})), async (c) => {
  const { message, signature, publicKey } = c.req.valid("json");
  
  if (!isValidPublicKey(publicKey)) {
    return c.json({ valid: false, error: "Invalid public key format" });
  }
  
  if (!isValidSignature(signature)) {
    return c.json({ valid: false, error: "Invalid signature format" });
  }
  
  const valid = await verifySignature(message, signature, publicKey);
  
  return c.json({ valid });
});

// ============================================
// Demo endpoint (for Ave Playground only)
// ============================================

const DEMO_CLIENT_ID = "app_4488d5deb6013090e9f84b87cda541f9";

// Create a demo signature request using OAuth access token
app.post("/demo/request", zValidator("json", z.object({
  payload: z.string().min(1).max(1000),
})), async (c) => {
  const { payload } = c.req.valid("json");
  
  // Verify OAuth access token
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const token = authHeader.slice(7);
  
  const jwtPayload = await verifyJwt(token, getResourceAudience());
  if (!jwtPayload) {
    return c.json({ error: "Invalid token" }, 401);
  }
  
  const identityId = String(jwtPayload.sub || "");
  if (!identityId) {
    return c.json({ error: "Invalid token - no identity" }, 401);
  }
  
  // Get the demo app
  const [demoApp] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.clientId, DEMO_CLIENT_ID))
    .limit(1);
  
  if (!demoApp) {
    return c.json({ error: "Demo app not configured" }, 500);
  }
  
  // Verify identity exists
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.id, identityId))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }
  
  // Create the request (expires in 5 minutes)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  
  const [request] = await db
    .insert(signatureRequests)
    .values({
      identityId,
      appId: demoApp.id,
      payload,
      metadata: { demo: true },
      expiresAt,
    })
    .returning();
  
  return c.json({
    requestId: request.id,
    expiresAt: request.expiresAt,
  });
});

export default app;
