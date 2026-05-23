const STORAGE_AVAILABLE_KEY = "ave_master_key_available";
const STORAGE_LEGACY_KEY = "ave_master_key";
const DB_NAME = "ave_key_storage";
const STORE_NAME = "keys";
const MASTER_KEY_ID = "master_key";
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open key storage"));
  });
}

async function putMasterKey(masterKey: CryptoKey): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(masterKey, MASTER_KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Failed to store key"));
      tx.onabort = () => reject(tx.error || new Error("Key storage was aborted"));
    });
  } finally {
    db.close();
  }
}

async function getMasterKey(): Promise<CryptoKey | null> {
  const db = await openDatabase();
  try {
    return await new Promise<CryptoKey | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(MASTER_KEY_ID);
      request.onsuccess = () => resolve((request.result as CryptoKey | undefined) || null);
      request.onerror = () => reject(request.error || new Error("Failed to read key"));
    });
  } finally {
    db.close();
  }
}

export async function importMasterKey(keyData: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyData, { name: ALGORITHM, length: KEY_LENGTH }, true, ["encrypt", "decrypt"]);
}

export async function exportMasterKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey("raw", key);
}

export async function encrypt(data: ArrayBuffer | string, key: CryptoKey): Promise<string> {
  const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, buffer);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return bytesToBase64(combined);
}

export async function decrypt(encryptedData: string, key: CryptoKey): Promise<ArrayBuffer> {
  const combined = base64ToBytes(encryptedData);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  return crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
}

export async function storeMasterKey(masterKey: CryptoKey): Promise<void> {
  await putMasterKey(masterKey);
  localStorage.setItem(STORAGE_AVAILABLE_KEY, "1");
  localStorage.removeItem(STORAGE_LEGACY_KEY);
}

export async function loadMasterKey(): Promise<CryptoKey | null> {
  try {
    const key = await getMasterKey();
    if (key) return key;
  } catch {
  }

  const legacy = localStorage.getItem(STORAGE_LEGACY_KEY);
  if (!legacy) return null;
  const bytes = base64ToBytes(legacy);
  const keyBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const key = await importMasterKey(keyBuffer);
  await storeMasterKey(key);
  return key;
}

export async function decryptMasterKeyWithPrf(encryptedMasterKey: string, prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const prfKey = await crypto.subtle.importKey("raw", prfOutput, { name: ALGORITHM, length: KEY_LENGTH }, false, ["encrypt", "decrypt"]);
  const masterKeyData = await decrypt(encryptedMasterKey, prfKey);
  return importMasterKey(masterKeyData);
}
