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

import { createHash, randomBytes, randomInt } from "crypto";
import { TRUST_CODE_WORDS } from "./trust-code-words";

// Generate a trust code in format ALPHA-BRAVO-CHARLIE-DELTA
export function generateTrustCode(): string {
  const segments = 6;
  const parts: string[] = [];

  for (let i = 0; i < segments; i++) {
    parts.push(TRUST_CODE_WORDS[randomInt(TRUST_CODE_WORDS.length)]);
  }

  return parts.join("-");
}

// Hash a trust code for storage (we don't store plaintext)
export function hashTrustCode(code: string): string {
  // Normalize: uppercase and strip separators/whitespace/non-alphanumeric chars
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

// Verify a trust code against a hash
export function verifyTrustCode(code: string, hash: string): boolean {
  return hashTrustCode(code) === hash;
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
