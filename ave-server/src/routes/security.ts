import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, passkeys, trustCodes, activityLogs } from "../db";
import { requireAuth } from "../middleware/auth";
import { 
  generateTrustCode, 
  hashTrustCode
} from "../lib/crypto";
import { eq, and, desc } from "drizzle-orm";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isAllowedWebauthnOrigin } from "../lib/webauthn-origin";
import { deleteChallenge, getChallenge, setChallenge } from "../lib/challenge-store";

const app = new Hono();

// All routes require authentication
app.use("*", requireAuth);

// Get security overview
app.get("/", async (c) => {
  const user = c.get("user")!;
  
  // Get passkeys
  const userPasskeys = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.userId, user.id))
    .orderBy(desc(passkeys.createdAt));
  
  // Get trust codes count (all codes, since they're reusable)
  const userTrustCodes = await db
    .select()
    .from(trustCodes)
    .where(eq(trustCodes.userId, user.id));
  
  return c.json({
    passkeys: userPasskeys.map((pk) => ({
      id: pk.id,
      name: pk.name,
      createdAt: pk.createdAt,
      lastUsedAt: pk.lastUsedAt,
      deviceType: pk.deviceType,
    })),
    trustCodesRemaining: userTrustCodes.length,
    securityQuestionIds: [],
  });
});

// Get passkey registration options
app.post("/passkeys/register", async (c) => {
  const user = c.get("user")!;
  
  const rpId = process.env.RP_ID || "localhost";
  const rpName = process.env.RP_NAME || "Ave";
  
  // Get existing passkeys to exclude
  const existingPasskeys = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.userId, user.id));
  
  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userName: user.id,
    userDisplayName: "Ave User",
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existingPasskeys.map((pk) => ({
      id: pk.id,
      transports: pk.transports as any,
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });
  
  // Store challenge
  await setChallenge(
    "security-passkey-register",
    user.id,
    { challenge: options.challenge },
    5 * 60 * 1000
  );
  
  return c.json({ options });
});

// Complete passkey registration
app.post("/passkeys/complete", zValidator("json", z.object({
  credential: z.any(),
  name: z.string().max(64).optional(),
  prfEncryptedMasterKey: z.string().optional(), // PRF-encrypted master key if passkey supports PRF
})), async (c) => {
  const user = c.get("user")!;
  const { credential, name, prfEncryptedMasterKey } = c.req.valid("json");
  
  console.log("[Security] Passkey registration - prfEncryptedMasterKey received:", prfEncryptedMasterKey ? `${prfEncryptedMasterKey.substring(0, 50)}...` : "undefined");
  
  const storedChallenge = await getChallenge<{ challenge: string }>(
    "security-passkey-register",
    user.id
  );
  if (!storedChallenge) {
    return c.json({ error: "Registration session expired" }, 400);
  }
  
  const rpId = process.env.RP_ID || "localhost";
  
  // Extract origin from the credential's clientDataJSON to support any localhost port
  let expectedOrigin: string;
  try {
    const clientDataJSON = JSON.parse(
      Buffer.from(credential.response.clientDataJSON, "base64url").toString("utf-8")
    );
    expectedOrigin = clientDataJSON.origin;
    
    // Validate origin is localhost (for development) or configured production origin
    const prodOrigin = process.env.RP_ORIGIN;
    const isValidOrigin = expectedOrigin.match(/^http:\/\/localhost(:\d+)?$/) || 
                          expectedOrigin === prodOrigin;
    if (!isValidOrigin) {
      return c.json({ error: "Invalid origin" }, 400);
    }
  } catch {
    return c.json({ error: "Invalid credential format" }, 400);
  }
  
  try {
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin,
      expectedRPID: rpId,
    });
    
    if (!verification.verified || !verification.registrationInfo) {
      return c.json({ error: "Passkey verification failed" }, 400);
    }
    
    await deleteChallenge("security-passkey-register", user.id);
    
    const { registrationInfo } = verification;
    
    // Create passkey
    // Note: registrationInfo.credential.id is already a base64url string from @simplewebauthn
    const [passkey] = await db
      .insert(passkeys)
      .values({
        id: registrationInfo.credential.id,
        userId: user.id,
        publicKey: Buffer.from(registrationInfo.credential.publicKey).toString("base64"),
        counter: registrationInfo.credential.counter,
        deviceType: registrationInfo.credentialDeviceType,
        backedUp: registrationInfo.credentialBackedUp,
        transports: credential.response?.transports,
        name: name || "New Passkey",
        prfEncryptedMasterKey, // Store PRF-encrypted master key if provided
      })
      .returning();
    
    // Log activity
    await db.insert(activityLogs).values({
      userId: user.id,
      action: "passkey_added",
      details: { passkeyId: passkey.id, name: passkey.name },
      deviceId: user.deviceId,
      ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      userAgent: c.req.header("user-agent"),
      severity: "info",
    });
    
    return c.json({
      passkey: {
        id: passkey.id,
        name: passkey.name,
        createdAt: passkey.createdAt,
        deviceType: passkey.deviceType,
      },
    });
  } catch (error) {
    console.error("Passkey registration error:", error);
    return c.json({ error: "Passkey verification failed" }, 400);
  }
});

// Update passkey (name and/or PRF encrypted master key)
app.patch("/passkeys/:passkeyId", zValidator("json", z.object({
  name: z.string().min(1).max(64).optional(),
  prfEncryptedMasterKey: z.string().optional(),
})), async (c) => {
  const user = c.get("user")!;
  const passkeyId = c.req.param("passkeyId");
  const { name, prfEncryptedMasterKey } = c.req.valid("json");
  
  const [passkey] = await db
    .select()
    .from(passkeys)
    .where(and(eq(passkeys.id, passkeyId), eq(passkeys.userId, user.id)))
    .limit(1);
  
  if (!passkey) {
    return c.json({ error: "Passkey not found" }, 404);
  }
  
  // Build update object
  const updateData: { name?: string; prfEncryptedMasterKey?: string } = {};
  if (name) updateData.name = name;
  if (prfEncryptedMasterKey) updateData.prfEncryptedMasterKey = prfEncryptedMasterKey;
  
  if (Object.keys(updateData).length > 0) {
    await db
      .update(passkeys)
      .set(updateData)
      .where(eq(passkeys.id, passkeyId));
  }
  
  return c.json({ success: true });
});

app.post("/master-key/unlock/start", async (c) => {
  const user = c.get("user")!;

  const rpId = process.env.RP_ID || "localhost";

  const userPasskeys = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.userId, user.id))
    .orderBy(desc(passkeys.createdAt));

  const prfPasskeys = userPasskeys.filter((pk) => !!pk.prfEncryptedMasterKey);
  if (prfPasskeys.length === 0) {
    return c.json({ error: "no_prf_passkey" }, 400);
  }

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    userVerification: "required",
    allowCredentials: prfPasskeys.map((pk) => ({
      id: pk.id,
      transports: pk.transports as any,
    })),
  });

  const unlockSessionId = crypto.randomUUID();
  await setChallenge(
    "security-unlock",
    unlockSessionId,
    {
      userId: user.id,
      challenge: options.challenge,
    },
    5 * 60 * 1000
  );

  return c.json({ unlockSessionId, options });
});

app.post(
  "/master-key/unlock/finish",
  zValidator(
    "json",
    z.object({
      unlockSessionId: z.string().min(1),
      credential: z.any(),
    })
  ),
  async (c) => {
    const user = c.get("user")!;
    const { unlockSessionId, credential } = c.req.valid("json");

    const storedChallenge = await getChallenge<{ userId: string; challenge: string }>(
      "security-unlock",
      unlockSessionId
    );
    if (!storedChallenge) {
      return c.json({ error: "unlock_session_expired" }, 400);
    }

    if (storedChallenge.userId !== user.id) {
      return c.json({ error: "forbidden" }, 403);
    }

    const rpId = process.env.RP_ID || "localhost";

    let expectedOrigin: string;
    try {
      const clientDataJSON = JSON.parse(
        Buffer.from(credential.response.clientDataJSON, "base64url").toString("utf-8")
      );
      expectedOrigin = clientDataJSON.origin;
      if (!isAllowedWebauthnOrigin(expectedOrigin)) {
        return c.json({ error: "invalid_origin" }, 400);
      }
    } catch {
      return c.json({ error: "invalid_credential_format" }, 400);
    }

    const [passkey] = await db
      .select()
      .from(passkeys)
      .where(and(eq(passkeys.id, credential.id), eq(passkeys.userId, user.id)))
      .limit(1);

    if (!passkey) {
      return c.json({ error: "passkey_not_found" }, 404);
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: storedChallenge.challenge,
        expectedOrigin,
        expectedRPID: rpId,
        credential: {
          id: passkey.id,
          publicKey: Buffer.from(passkey.publicKey, "base64"),
          counter: passkey.counter,
          transports: passkey.transports as any,
        },
      });

      if (!verification.verified) {
        return c.json({ error: "passkey_verification_failed" }, 400);
      }

      await deleteChallenge("security-unlock", unlockSessionId);

      await db
        .update(passkeys)
        .set({
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date(),
        })
        .where(eq(passkeys.id, passkey.id));

      if (!passkey.prfEncryptedMasterKey) {
        return c.json({ error: "no_prf_master_key" }, 400);
      }

      return c.json({ prfEncryptedMasterKey: passkey.prfEncryptedMasterKey });
    } catch (error) {
      console.error("Passkey unlock verification error:", error);
      return c.json({ error: "passkey_verification_failed" }, 400);
    }
  }
);

// Delete passkey
app.delete("/passkeys/:passkeyId", async (c) => {
  const user = c.get("user")!;
  const passkeyId = c.req.param("passkeyId");
  
  const [passkey] = await db
    .select()
    .from(passkeys)
    .where(and(eq(passkeys.id, passkeyId), eq(passkeys.userId, user.id)))
    .limit(1);
  
  if (!passkey) {
    return c.json({ error: "Passkey not found" }, 404);
  }
  
  // Check if this is the last passkey
  const allPasskeys = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.userId, user.id));
  
  if (allPasskeys.length === 1) {
    return c.json({ error: "Cannot delete your only passkey" }, 400);
  }
  
  await db.delete(passkeys).where(eq(passkeys.id, passkeyId));
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "passkey_removed",
    details: { passkeyId, name: passkey.name },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });
  
  return c.json({ success: true });
});

// Regenerate trust codes
app.post("/trust-codes/regenerate", async (c) => {
  const user = c.get("user")!;
  
  // Delete old codes
  await db.delete(trustCodes).where(eq(trustCodes.userId, user.id));
  
  // Generate new codes
  const codes: string[] = [];
  for (let i = 0; i < 2; i++) {
    const code = generateTrustCode();
    codes.push(code);
    await db.insert(trustCodes).values({
      userId: user.id,
      codeHash: hashTrustCode(code),
    });
  }
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "trust_codes_regenerated",
    details: {},
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });
  
  return c.json({ codes });
});

// Security questions were removed from Ave.
app.put("/questions", zValidator("json", z.object({
  questions: z.array(z.object({
    questionId: z.number().min(0).max(20),
    answer: z.string().min(1),
  })).length(3),
})), async (c) => {
  c.req.valid("json");
  return c.json({ error: "security_questions_removed" }, 410);
});

export default app;
