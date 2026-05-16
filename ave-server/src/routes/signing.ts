import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, signingKeys, signatureRequests, identities, oauthApps } from "../db";
import { requireAuth, requireWritable } from "../middleware/auth";
import { eq, and, desc, gt, inArray } from "drizzle-orm";
import { verifySignature, isValidPublicKey, isValidSignature } from "../lib/signing";
import { verifyJwt, getResourceAudience } from "../lib/oidc";
import { hashSessionToken } from "../lib/crypto";
import { enforceRateLimits, ipRateLimit, subjectRateLimit } from "../lib/rate-limit";
import { timingSafeEqual } from "crypto";
import signingKeyRoutes from "./signing-keys";
import { recordActivityLog } from "../lib/background-events";
const app = new Hono();
app.route("/", signingKeyRoutes);
function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
app.get("/requests", requireAuth, async (c) => {
  const user = c.get("user")!;
  
  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, user.id));
  
  const identityIds = userIdentities.map((i) => i.id);
  
  if (identityIds.length === 0) {
    return c.json({ requests: [] });
  }
  
  const requests = await db
    .select({
      request: signatureRequests,
      app: oauthApps,
      identity: identities,
    })
    .from(signatureRequests)
    .innerJoin(oauthApps, eq(oauthApps.id, signatureRequests.appId))
    .innerJoin(identities, eq(identities.id, signatureRequests.identityId))
    .where(and(
      eq(signatureRequests.status, "pending"),
      gt(signatureRequests.expiresAt, new Date()),
      inArray(signatureRequests.identityId, identityIds),
    ))
    .orderBy(desc(signatureRequests.createdAt));
  
  return c.json({
    requests: requests.map((r) => ({
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
  const requestId = c.req.param("requestId") || "";
  
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
    signingKey: result.signingKey && isValidPublicKey(result.signingKey.publicKey) ? {
      publicKey: result.signingKey.publicKey,
      encryptedPrivateKey: result.signingKey.encryptedPrivateKey,
    } : null,
  });
});

// Sign a request (submit signature from client)
app.post("/requests/:requestId/sign", requireAuth, requireWritable, zValidator("json", z.object({
  signature: z.string().min(1),
})), async (c) => {
  const user = c.get("user")!;
  const requestId = c.req.param("requestId") || "";
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
  
  if (!result.signingKey || !isValidPublicKey(result.signingKey.publicKey)) {
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
  recordActivityLog(c, {
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
app.post("/requests/:requestId/deny", requireAuth, requireWritable, async (c) => {
  const user = c.get("user")!;
  const requestId = c.req.param("requestId") || "";
  
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
  recordActivityLog(c, {
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

// Create a signature request (from an OAuth app)
app.post("/request", zValidator("json", z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  identityId: z.string().uuid(),
  payload: z.string().min(1).max(10000), // Max 10KB payload
  metadata: z.record(z.string(), z.unknown()).optional(),
  expiresInSeconds: z.number().min(60).max(3600).default(300), // 5 min default, max 1 hour
})), async (c) => {
  const { clientId, clientSecret, identityId, payload, metadata, expiresInSeconds } = c.req.valid("json");
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "signing:request:ip", 120, 60 * 1000),
    subjectRateLimit("signing:request:client", clientId, 120, 60 * 1000),
    subjectRateLimit("signing:request:identity", identityId, 30, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;
  
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
  
  if (!signingKey || !isValidPublicKey(signingKey.publicKey)) {
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
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "signing:status:ip", 240, 60 * 1000),
    subjectRateLimit("signing:status:request", requestId, 240, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;
  
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
  const rateLimitResponse = await enforceRateLimits(c, [
    ipRateLimit(c, "signing:verify:ip", 180, 60 * 1000),
  ]);
  if (rateLimitResponse) return rateLimitResponse;
  
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
  
  const [demoApp] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.clientId, DEMO_CLIENT_ID))
    .limit(1);
  
  if (!demoApp) {
    return c.json({ error: "Demo app not configured" }, 500);
  }
  
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.id, identityId))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }
  
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
