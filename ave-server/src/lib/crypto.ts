/**
 * Cryptographic utilities for Ave
 * 
 * This module handles:
 * - Trust code generation
 * - Password/answer hashing (for security questions)
 * - Session token generation
 * - Key derivation
 * 
 * Note: The actual E2EE master key operations happen CLIENT-SIDE.
 * The server only stores encrypted blobs it cannot decrypt.
 */

import { createHash, randomBytes } from "crypto";

// Generate a trust code in format XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
export function generateTrustCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars: 0, O, I, 1
  const segments = 5;
  const segmentLength = 5;
  
  const parts: string[] = [];
  for (let i = 0; i < segments; i++) {
    let segment = "";
    for (let j = 0; j < segmentLength; j++) {
      const randomIndex = randomBytes(1)[0] % chars.length;
      segment += chars[randomIndex];
    }
    parts.push(segment);
  }
  
  return parts.join("-");
}

// Hash a trust code for storage (we don't store plaintext)
export function hashTrustCode(code: string): string {
  // Normalize: uppercase, remove dashes
  const normalized = code.toUpperCase().replace(/-/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

// Verify a trust code against a hash
export function verifyTrustCode(code: string, hash: string): boolean {
  return hashTrustCode(code) === hash;
}

// Hash security question answers
// We use SHA-256 with salt for simplicity, but argon2 would be better for production
export function hashSecurityAnswer(answer: string, salt: string): string {
  // Normalize: lowercase, trim, remove extra spaces
  const normalized = answer.toLowerCase().trim().replace(/\s+/g, " ");
  return createHash("sha256").update(salt + normalized).digest("hex");
}

// Generate a random salt
export function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

// Generate a session token
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

// Hash a session token for storage
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Generate a random ID (for things like client IDs)
export function generateRandomId(length: number = 32): string {
  return randomBytes(length).toString("hex").slice(0, length);
}

// Generate bytes as base64 (for WebAuthn challenges, etc.)
export function generateChallenge(): string {
  return randomBytes(32).toString("base64url");
}
