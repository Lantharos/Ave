import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import { db, users, identities, passkeys, devices, sessions, trustCodes, activityLogs } from "../db";
import { 
  generateTrustCode, 
  hashTrustCode, 
  generateSessionToken, 
  hashSessionToken,
} from "../lib/crypto";
import { eq } from "drizzle-orm";

const app = new Hono();

// In-memory store for registration challenges (in production, use Redis)
const registrationChallenges = new Map<string, { challenge: string; expiresAt: number }>();

// Schema for starting registration
const startRegistrationSchema = z.object({
  handle: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, "Handle can only contain letters, numbers, and underscores"),
});

// Start registration - returns WebAuthn options
app.post("/start", zValidator("json", startRegistrationSchema), async (c) => {
  const { handle } = c.req.valid("json");
  
  // Check if handle is taken
  const existing = await db
    .select({ id: identities.id })
    .from(identities)
    .where(eq(identities.handle, handle.toLowerCase()))
    .limit(1);
  
  if (existing.length > 0) {
    return c.json({ error: "Handle is already taken" }, 400);
  }
  
  const rpId = process.env.RP_ID || "localhost";
  const rpName = process.env.RP_NAME || "Ave";
  
  // Generate a temporary user ID for this registration attempt
  const tempUserId = crypto.randomUUID();
  
  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userName: handle,
    userDisplayName: handle,
    userID: new TextEncoder().encode(tempUserId),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });
  
  // Store challenge temporarily
  registrationChallenges.set(tempUserId, {
    challenge: options.challenge,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
  
  return c.json({
    options,
    tempUserId,
  });
});

// Schema for completing registration
const completeRegistrationSchema = z.object({
  tempUserId: z.string().uuid(),
  credential: z.any(), // WebAuthn response
  identity: z.object({
    displayName: z.string().min(1).max(64),
    handle: z.string().min(3).max(32),
    email: z.string().email().optional(),
    birthday: z.string().optional(),
    avatarUrl: z.string().url().optional(),
    bannerUrl: z.string().url().optional(),
  }),
  // Device info
  device: z.object({
    name: z.string().max(64),
    type: z.enum(["phone", "computer", "tablet"]),
    browser: z.string().optional(),
    os: z.string().optional(),
    fingerprint: z.string().max(64).optional(),
  }),
  // PRF-encrypted master key (if passkey supports PRF extension)
  prfEncryptedMasterKey: z.string().optional(),
});

// Complete registration
app.post("/complete", zValidator("json", completeRegistrationSchema), async (c) => {
  const data = c.req.valid("json");
  
  // Verify challenge
  const storedChallenge = registrationChallenges.get(data.tempUserId);
  if (!storedChallenge || Date.now() > storedChallenge.expiresAt) {
    return c.json({ error: "Registration session expired" }, 400);
  }
  
  const rpId = process.env.RP_ID || "localhost";
  // For development, accept any localhost origin
  const configuredOrigin = process.env.RP_ORIGIN || "http://localhost:5173";
  const clientOrigin = data.credential.response?.clientDataJSON 
    ? JSON.parse(Buffer.from(data.credential.response.clientDataJSON, "base64").toString()).origin
    : configuredOrigin;
  
  // In development, allow any localhost port
  const expectedOrigin = clientOrigin && clientOrigin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)
    ? clientOrigin 
    : configuredOrigin;
  
  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response: data.credential,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin,
      expectedRPID: rpId,
    });
  } catch (error) {
    console.error("WebAuthn verification failed:", error);
    return c.json({ error: "Passkey verification failed" }, 400);
  }
  
  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ error: "Passkey verification failed" }, 400);
  }
  
  // Clean up challenge
  registrationChallenges.delete(data.tempUserId);
  
  const { registrationInfo } = verification;
  
  // Create user, identity, passkey, device in a transaction
  const result = await db.transaction(async (tx) => {
    // Create user (no encryptedMasterKeyBackup yet - will be set after client encrypts with real trust codes)
    const [user] = await tx
      .insert(users)
      .values({})
      .returning();
    
    // Create identity
    const [identity] = await tx
      .insert(identities)
      .values({
        userId: user.id,
        displayName: data.identity.displayName,
        handle: data.identity.handle.toLowerCase(),
        email: data.identity.email,
        birthday: data.identity.birthday,
        avatarUrl: data.identity.avatarUrl,
        bannerUrl: data.identity.bannerUrl,
        isPrimary: true,
      })
      .returning();
    
    // Create passkey
    // Note: registrationInfo.credential.id is already a base64url string from @simplewebauthn
    await tx.insert(passkeys).values({
      id: registrationInfo.credential.id,
      userId: user.id,
      publicKey: Buffer.from(registrationInfo.credential.publicKey).toString("base64"),
      counter: registrationInfo.credential.counter,
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
      transports: data.credential.response?.transports,
      name: data.device.name + " Passkey",
      // Store PRF-encrypted master key if provided (for passkeys that support PRF extension)
      prfEncryptedMasterKey: data.prfEncryptedMasterKey,
    });
    
    // Create device
    const [device] = await tx
      .insert(devices)
      .values({
        userId: user.id,
        name: data.device.name,
        type: data.device.type,
        browser: data.device.browser,
        os: data.device.os,
        fingerprint: data.device.fingerprint,
      })
      .returning();
    
    // Generate trust codes (2 codes)
    const codes: string[] = [];
    for (let i = 0; i < 2; i++) {
      const code = generateTrustCode();
      codes.push(code);
      const hash = hashTrustCode(code);
      console.log(`[Registration] Generated trust code ${i + 1}: ${code} -> hash: ${hash.substring(0, 10)}...`);
      await tx.insert(trustCodes).values({
        userId: user.id,
        codeHash: hash,
      });
    }
    
    console.log(`[Registration] Created ${codes.length} trust codes for user ${user.id}`);
    
    // Create session
    const sessionToken = generateSessionToken();
    const [session] = await tx
      .insert(sessions)
      .values({
        userId: user.id,
        deviceId: device.id,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
        userAgent: c.req.header("user-agent"),
      })
      .returning();
    
    // Log activity
    await tx.insert(activityLogs).values({
      userId: user.id,
      action: "account_created",
      details: { handle: data.identity.handle },
      deviceId: device.id,
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      severity: "info",
    });
    
    return {
      user,
      identity,
      device,
      sessionToken,
      trustCodes: codes,
    };
  });
  
  return c.json({
    success: true,
    sessionToken: result.sessionToken,
    trustCodes: result.trustCodes,
    user: {
      id: result.user.id,
    },
    identity: {
      id: result.identity.id,
      displayName: result.identity.displayName,
      handle: result.identity.handle,
      email: result.identity.email,
      avatarUrl: result.identity.avatarUrl,
      bannerUrl: result.identity.bannerUrl,
    },
    device: {
      id: result.device.id,
      name: result.device.name,
      type: result.device.type,
    },
  });
});

// Check if handle is available
app.get("/check-handle/:handle", async (c) => {
  const handle = c.req.param("handle").toLowerCase();
  
  if (handle.length < 3 || handle.length > 32) {
    return c.json({ available: false, reason: "Handle must be 3-32 characters" });
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(handle)) {
    return c.json({ available: false, reason: "Handle can only contain letters, numbers, and underscores" });
  }
  
  const existing = await db
    .select({ id: identities.id })
    .from(identities)
    .where(eq(identities.handle, handle))
    .limit(1);
  
  return c.json({ available: existing.length === 0 });
});



// Finalize master key backup (called after client encrypts with real trust codes)
app.post("/finalize-backup", zValidator("json", z.object({
  encryptedMasterKeyBackup: z.string(),
})), async (c) => {
  // Get session token from header
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const token = authHeader.slice(7);
  const tokenHash = hashSessionToken(token);
  
  // Find session
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  
  if (!session) {
    return c.json({ error: "Invalid session" }, 401);
  }
  
  const { encryptedMasterKeyBackup } = c.req.valid("json");
  
  // Update user with the encrypted backup
  await db
    .update(users)
    .set({ encryptedMasterKeyBackup })
    .where(eq(users.id, session.userId));
  
  console.log(`[Finalize Backup] Updated master key backup for user ${session.userId}`);
  
  return c.json({ success: true });
});

export default app;
