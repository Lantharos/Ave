/**
 * Client-side cryptographic utilities for Ave E2EE
 * 
 * This module handles:
 * - Master key generation and storage
 * - Encryption/decryption of data
 * - Key derivation from trust codes
 * - Ephemeral key exchange for login approval
 */

// Constants
const MASTER_KEY_STORAGE_KEY = "ave_master_key";
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

/**
 * Generate a new master key
 */
export async function generateMasterKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable (so we can export for backup)
    ["encrypt", "decrypt"]
  );
}

/**
 * Export master key to raw bytes
 */
export async function exportMasterKey(key: CryptoKey): Promise<ArrayBuffer> {
  return await crypto.subtle.exportKey("raw", key);
}

/**
 * Import master key from raw bytes
 */
export async function importMasterKey(keyData: ArrayBuffer): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Derive an encryption key from a trust code
 * Used to encrypt the master key backup
 */
export async function deriveKeyFromTrustCode(code: string): Promise<CryptoKey> {
  // Normalize the code
  const normalized = code.toUpperCase().replace(/-/g, "");
  const encoder = new TextEncoder();
  
  // Use PBKDF2 to derive a key
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(normalized),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  // Static salt for trust code derivation (in production, might want per-user salt)
  const salt = encoder.encode("ave-trust-code-salt-v1");
  
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt data with a key
 */
export async function encrypt(
  data: ArrayBuffer | string,
  key: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = typeof data === "string" ? encoder.encode(data) : data;
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    dataBuffer
  );
  
  // Combine IV + encrypted data and encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data with a key
 */
export async function decrypt(
  encryptedData: string,
  key: CryptoKey
): Promise<ArrayBuffer> {
  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
  
  // Extract IV and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  return await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );
}

/**
 * Decrypt to string
 */
export async function decryptToString(
  encryptedData: string,
  key: CryptoKey
): Promise<string> {
  const decrypted = await decrypt(encryptedData, key);
  return new TextDecoder().decode(decrypted);
}

/**
 * Create encrypted master key backup (for trust code recovery)
 */
export async function createMasterKeyBackup(
  masterKey: CryptoKey,
  trustCodes: string[]
): Promise<string> {
  // Export the master key
  const masterKeyData = await exportMasterKey(masterKey);
  
  // Encrypt with each trust code and store together
  // This way any single trust code can recover the master key
  const backups: string[] = [];
  
  for (const code of trustCodes) {
    const derivedKey = await deriveKeyFromTrustCode(code);
    const encrypted = await encrypt(masterKeyData, derivedKey);
    backups.push(encrypted);
  }
  
  // Store as JSON with metadata
  return JSON.stringify({
    version: 1,
    backups,
  });
}

/**
 * Recover master key from backup using a trust code
 */
export async function recoverMasterKeyFromBackup(
  backup: string,
  trustCode: string
): Promise<CryptoKey | null> {
  try {
    const data = JSON.parse(backup);
    const derivedKey = await deriveKeyFromTrustCode(trustCode);
    
    // Try each backup (in case codes were regenerated)
    for (const encryptedBackup of data.backups) {
      try {
        const masterKeyData = await decrypt(encryptedBackup, derivedKey);
        return await importMasterKey(masterKeyData);
      } catch {
        // This code doesn't match, try next
        continue;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate ephemeral keypair for login key exchange
 */
export async function generateEphemeralKeyPair(): Promise<{
  publicKey: string;
  privateKey: CryptoKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey"]
  );
  
  // Export public key for sending to server
  const publicKeyData = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const publicKey = btoa(String.fromCharCode(...new Uint8Array(publicKeyData)));
  
  return {
    publicKey,
    privateKey: keyPair.privateKey,
  };
}

/**
 * Import a public key from base64 SPKI format
 */
export async function importPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  const publicKeyData = Uint8Array.from(atob(publicKeyB64), (c) => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    "spki",
    publicKeyData,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

/**
 * Derive a shared secret from ECDH key exchange
 */
export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  return await crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt master key for sending to another device
 */
export async function encryptMasterKeyForDevice(
  masterKey: CryptoKey,
  recipientPublicKeyB64: string,
  senderPrivateKey: CryptoKey
): Promise<string> {
  const recipientPublicKey = await importPublicKey(recipientPublicKeyB64);
  const sharedKey = await deriveSharedKey(senderPrivateKey, recipientPublicKey);
  const masterKeyData = await exportMasterKey(masterKey);
  return await encrypt(masterKeyData, sharedKey);
}

/**
 * Decrypt master key received from another device
 */
export async function decryptMasterKeyFromDevice(
  encryptedMasterKey: string,
  senderPublicKeyB64: string,
  recipientPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const senderPublicKey = await importPublicKey(senderPublicKeyB64);
  const sharedKey = await deriveSharedKey(recipientPrivateKey, senderPublicKey);
  const masterKeyData = await decrypt(encryptedMasterKey, sharedKey);
  return await importMasterKey(masterKeyData);
}

/**
 * Store master key in browser (encrypted with device key)
 * In a real implementation, you might use IndexedDB with device binding
 */
export async function storeMasterKey(masterKey: CryptoKey): Promise<void> {
  // For simplicity, we store the raw key in localStorage
  // In production, you'd want to use IndexedDB and possibly bind to device
  const keyData = await exportMasterKey(masterKey);
  const encoded = btoa(String.fromCharCode(...new Uint8Array(keyData)));
  localStorage.setItem(MASTER_KEY_STORAGE_KEY, encoded);
}

/**
 * Load master key from browser storage
 */
export async function loadMasterKey(): Promise<CryptoKey | null> {
  const encoded = localStorage.getItem(MASTER_KEY_STORAGE_KEY);
  if (!encoded) return null;
  
  try {
    const keyData = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    return await importMasterKey(keyData.buffer);
  } catch {
    return null;
  }
}

/**
 * Clear master key from storage
 */
export function clearMasterKey(): void {
  localStorage.removeItem(MASTER_KEY_STORAGE_KEY);
}

/**
 * Check if master key exists in storage
 */
export function hasMasterKey(): boolean {
  return localStorage.getItem(MASTER_KEY_STORAGE_KEY) !== null;
}

/**
 * Derive an AES key from PRF output
 * PRF output is high-entropy, so we just import it directly as a key
 */
export async function deriveKeyFromPrf(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  // PRF output is 32 bytes of cryptographically random data
  // We can use it directly as an AES-256 key
  return await crypto.subtle.importKey(
    "raw",
    prfOutput,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt master key with PRF-derived key
 * Returns base64-encoded ciphertext (IV + encrypted data)
 */
export async function encryptMasterKeyWithPrf(
  masterKey: CryptoKey,
  prfOutput: ArrayBuffer
): Promise<string> {
  const prfKey = await deriveKeyFromPrf(prfOutput);
  const masterKeyData = await exportMasterKey(masterKey);
  return await encrypt(masterKeyData, prfKey);
}

/**
 * Decrypt master key with PRF-derived key
 */
export async function decryptMasterKeyWithPrf(
  encryptedMasterKey: string,
  prfOutput: ArrayBuffer
): Promise<CryptoKey> {
  const prfKey = await deriveKeyFromPrf(prfOutput);
  const masterKeyData = await decrypt(encryptedMasterKey, prfKey);
  return await importMasterKey(masterKeyData);
}

/**
 * Generate an app-specific encryption key for OAuth apps with E2EE
 */
export async function generateAppKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable (so we can export for storage)
    ["encrypt", "decrypt"]
  );
}

/**
 * Export app key to base64 string
 */
export async function exportAppKey(key: CryptoKey): Promise<string> {
  const keyData = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(keyData)));
}

/**
 * Import app key from base64 string
 */
export async function importAppKey(keyB64: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt an app key with the user's master key
 * This is stored on the server so the app can retrieve it on subsequent logins
 */
export async function encryptAppKey(
  appKey: CryptoKey,
  masterKey: CryptoKey
): Promise<string> {
  const appKeyData = await exportAppKey(appKey);
  return await encrypt(appKeyData, masterKey);
}

/**
 * Decrypt an app key with the user's master key
 */
export async function decryptAppKey(
  encryptedAppKey: string,
  masterKey: CryptoKey
): Promise<CryptoKey> {
  const appKeyB64 = await decryptToString(encryptedAppKey, masterKey);
  return await importAppKey(appKeyB64);
}
