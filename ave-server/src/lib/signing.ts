/**
 * Ave Signing - Server-side Ed25519 utilities
 * 
 * Used for verification of signatures on the server.
 * Key generation and signing happens client-side only.
 */

import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

// Configure ed25519 to use sha512
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

/**
 * Verify an Ed25519 signature
 */
export async function verifySignature(
  message: string,
  signatureB64: string,
  publicKeyB64: string
): Promise<boolean> {
  try {
    const publicKey = base64ToBytes(publicKeyB64);
    const signature = base64ToBytes(signatureB64);
    const messageBytes = new TextEncoder().encode(message);
    
    return await ed.verifyAsync(signature, messageBytes, publicKey);
  } catch {
    return false;
  }
}

/**
 * Validate that a public key is a valid Ed25519 public key (32 bytes)
 */
export function isValidPublicKey(publicKeyB64: string): boolean {
  try {
    const bytes = base64ToBytes(publicKeyB64);
    return bytes.length === 32;
  } catch {
    return false;
  }
}

/**
 * Validate that a signature is a valid Ed25519 signature (64 bytes)
 */
export function isValidSignature(signatureB64: string): boolean {
  try {
    const bytes = base64ToBytes(signatureB64);
    return bytes.length === 64;
  } catch {
    return false;
  }
}

// Utility functions
function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
