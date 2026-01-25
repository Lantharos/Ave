/**
 * Ave Signing - Ed25519 cryptographic signing utilities
 * 
 * Each identity gets an Ed25519 keypair for signing messages.
 * The private key is stored encrypted with the user's master key.
 */

import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";
import { encrypt, decrypt, loadMasterKey } from "./crypto";

// Configure ed25519 to use sha512
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

/**
 * Generate a new Ed25519 signing keypair
 * Returns both keys as base64 strings
 */
export async function generateSigningKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  // Generate 32-byte private key
  // noble-ed25519 v3 uses randomSecretKey()
  const privateKeyBytes = ed.utils.randomSecretKey();
  
  // Derive public key
  const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes);
  
  return {
    publicKey: bytesToBase64(publicKeyBytes),
    privateKey: bytesToBase64(privateKeyBytes),
  };
}

/**
 * Sign a message with an Ed25519 private key
 */
export async function signMessage(
  message: string,
  privateKeyB64: string
): Promise<string> {
  const privateKey = base64ToBytes(privateKeyB64);
  const messageBytes = new TextEncoder().encode(message);
  
  const signature = await ed.signAsync(messageBytes, privateKey);
  
  return bytesToBase64(signature);
}

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
 * Encrypt a signing private key with the user's master key
 */
export async function encryptSigningKey(
  privateKeyB64: string,
  masterKey: CryptoKey
): Promise<string> {
  return await encrypt(privateKeyB64, masterKey);
}

/**
 * Decrypt a signing private key with the user's master key
 */
export async function decryptSigningKey(
  encryptedPrivateKey: string,
  masterKey: CryptoKey
): Promise<string> {
  const decrypted = await decrypt(encryptedPrivateKey, masterKey);
  return new TextDecoder().decode(decrypted);
}

/**
 * Generate keypair and encrypt private key for storage
 * This is the main function called during identity creation
 */
export async function createSigningKeyForIdentity(): Promise<{
  publicKey: string;
  encryptedPrivateKey: string;
} | null> {
  const masterKey = await loadMasterKey();
  if (!masterKey) {
    console.error("[Signing] Cannot create signing key: no master key");
    return null;
  }
  
  const { publicKey, privateKey } = await generateSigningKeyPair();
  const encryptedPrivateKey = await encryptSigningKey(privateKey, masterKey);
  
  return {
    publicKey,
    encryptedPrivateKey,
  };
}

/**
 * Sign a message using an identity's encrypted private key
 */
export async function signWithIdentityKey(
  message: string,
  encryptedPrivateKey: string
): Promise<string | null> {
  const masterKey = await loadMasterKey();
  if (!masterKey) {
    console.error("[Signing] Cannot sign: no master key");
    return null;
  }
  
  const privateKey = await decryptSigningKey(encryptedPrivateKey, masterKey);
  return await signMessage(message, privateKey);
}

// Utility functions
function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// Re-export for convenience
export { verifySignature as verify };
