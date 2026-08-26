import { base64ToBytes, bytesToBase64, decrypt, deriveSharedKey, encrypt, exportMasterKey, importMasterKey, importPublicKey } from "./core";

const STORAGE_KEY = "ave_master_key";
const AVAILABLE_KEY = "ave_master_key_available";
const DATABASE_NAME = "ave_key_storage";
const STORE_NAME = "keys";
const MASTER_KEY_ID = "master_key";

function readLocal(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeLocal(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { }
}

function removeLocal(key: string): void {
  try { localStorage.removeItem(key); } catch { }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
}

async function putStoredKey(masterKey: CryptoKey): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(masterKey, MASTER_KEY_ID);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB write failed"));
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB write aborted"));
    });
  } finally { database.close(); }
}

async function getStoredKey(): Promise<CryptoKey | null> {
  const database = await openDatabase();
  try {
    return await new Promise<CryptoKey | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(MASTER_KEY_ID);
      request.onsuccess = () => resolve((request.result as CryptoKey | undefined) || null);
      request.onerror = () => reject(request.error || new Error("IndexedDB read failed"));
    });
  } finally { database.close(); }
}

async function deleteStoredKey(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(MASTER_KEY_ID);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB delete failed"));
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB delete aborted"));
    });
  } finally { database.close(); }
}

export async function deriveKeyFromTrustCode(code: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(code.toUpperCase().replace(/[^A-Z0-9]/g, "")), "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode("ave-trust-code-salt-v1"), iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

export async function createMasterKeyBackup(masterKey: CryptoKey, trustCodes: string[]): Promise<string> {
  const masterKeyData = await exportMasterKey(masterKey);
  const backups: string[] = [];
  for (const code of trustCodes) backups.push(await encrypt(masterKeyData, await deriveKeyFromTrustCode(code)));
  return JSON.stringify({ version: 1, backups });
}

export async function recoverMasterKeyFromBackup(backup: string, trustCode: string): Promise<CryptoKey | null> {
  try {
    const data = JSON.parse(backup) as { backups?: unknown };
    if (!Array.isArray(data.backups) || !data.backups.every((entry) => typeof entry === "string")) return null;
    const derivedKey = await deriveKeyFromTrustCode(trustCode);
    for (const encryptedBackup of data.backups) {
      try { return await importMasterKey(await decrypt(encryptedBackup, derivedKey)); } catch { }
    }
  } catch { }
  return null;
}

export async function encryptMasterKeyForDevice(masterKey: CryptoKey, recipientPublicKeyB64: string, senderPrivateKey: CryptoKey): Promise<string> {
  const sharedKey = await deriveSharedKey(senderPrivateKey, await importPublicKey(recipientPublicKeyB64));
  return encrypt(await exportMasterKey(masterKey), sharedKey);
}

export async function decryptMasterKeyFromDevice(encryptedMasterKey: string, senderPublicKeyB64: string, recipientPrivateKey: CryptoKey): Promise<CryptoKey> {
  const sharedKey = await deriveSharedKey(recipientPrivateKey, await importPublicKey(senderPublicKeyB64));
  return importMasterKey(await decrypt(encryptedMasterKey, sharedKey));
}

export async function storeMasterKey(masterKey: CryptoKey): Promise<void> {
  try {
    await putStoredKey(masterKey);
    writeLocal(AVAILABLE_KEY, "1");
    removeLocal(STORAGE_KEY);
    return;
  } catch { }
  writeLocal(STORAGE_KEY, bytesToBase64(new Uint8Array(await exportMasterKey(masterKey))));
  writeLocal(AVAILABLE_KEY, "1");
}

export async function loadMasterKey(): Promise<CryptoKey | null> {
  try {
    const stored = await getStoredKey();
    if (stored) {
      writeLocal(AVAILABLE_KEY, "1");
      removeLocal(STORAGE_KEY);
      return stored;
    }
  } catch { }
  const encoded = readLocal(STORAGE_KEY);
  if (!encoded) return null;
  try {
    const bytes = base64ToBytes(encoded);
    const key = await importMasterKey(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    try { await putStoredKey(key); removeLocal(STORAGE_KEY); } catch { }
    writeLocal(AVAILABLE_KEY, "1");
    return key;
  } catch { return null; }
}

export function clearMasterKey(): void {
  removeLocal(STORAGE_KEY);
  removeLocal(AVAILABLE_KEY);
  void deleteStoredKey();
}

export function hasMasterKey(): boolean {
  return readLocal(AVAILABLE_KEY) !== null || readLocal(STORAGE_KEY) !== null;
}

export async function hasStoredMasterKey(): Promise<boolean> {
  if (hasMasterKey()) return true;
  try { return (await getStoredKey()) !== null; } catch { return false; }
}

export async function masterKeysMatch(left: CryptoKey, right: CryptoKey): Promise<boolean> {
  try {
    const [leftData, rightData] = await Promise.all([exportMasterKey(left), exportMasterKey(right)]);
    const leftBytes = new Uint8Array(leftData);
    const rightBytes = new Uint8Array(rightData);
    if (leftBytes.length !== rightBytes.length) return false;
    return leftBytes.every((byte, index) => byte === rightBytes[index]);
  } catch { return false; }
}

export async function resolveActiveMasterKey(inMemoryKey?: CryptoKey | null): Promise<CryptoKey | null> {
  const stored = await loadMasterKey();
  if (stored && inMemoryKey && !(await masterKeysMatch(stored, inMemoryKey))) {
    await storeMasterKey(inMemoryKey);
    return inMemoryKey;
  }
  if (stored) return stored;
  if (inMemoryKey) await storeMasterKey(inMemoryKey);
  return inMemoryKey || null;
}

export function deriveKeyFromPrf(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", prfOutput, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptMasterKeyWithPrf(masterKey: CryptoKey, prfOutput: ArrayBuffer): Promise<string> {
  return encrypt(await exportMasterKey(masterKey), await deriveKeyFromPrf(prfOutput));
}

export async function decryptMasterKeyWithPrf(encryptedMasterKey: string, prfOutput: ArrayBuffer): Promise<CryptoKey> {
  return importMasterKey(await decrypt(encryptedMasterKey, await deriveKeyFromPrf(prfOutput)));
}
