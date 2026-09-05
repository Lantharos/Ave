const DATABASE_NAME = "ave_key_storage";
const STORE_NAME = "keys";
const LEGACY_ID = "master_key";
const LEGACY_LOCAL_KEY = "ave_master_key";
const memoryKeys = new Map<string, CryptoKey>();

function readLocal(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function removeLocal(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}

function validKey(value: unknown): value is CryptoKey {
  return typeof CryptoKey !== "undefined" && value instanceof CryptoKey
    && value.type === "secret" && value.algorithm.name === "AES-GCM"
    && value.usages.includes("decrypt") && value.usages.includes("encrypt");
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
    request.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
  });
}

async function readKeys(ids: string[]): Promise<unknown[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const requests = ids.map((id) => store.get(id));
      transaction.oncomplete = () => resolve(requests.map((request) => request.result));
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

async function writeKeys(ids: string[], key: CryptoKey | null, deleteLegacy = false): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      for (const id of ids) {
        if (key) store.put(key, `master_key:${id}`);
        else store.delete(`master_key:${id}`);
      }
      if (deleteLegacy) store.delete(LEGACY_ID);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

async function importLocalKey(value: string | null): Promise<CryptoKey | null> {
  if (!value) return null;
  try {
    return await crypto.subtle.importKey("raw", Uint8Array.from(atob(value), (byte) => byte.charCodeAt(0)), "AES-GCM", true, ["encrypt", "decrypt"]);
  } catch { return null; }
}

export async function loadBoundMasterKey(identityIds: string[]): Promise<CryptoKey | null> {
  if (!identityIds.length) return null;
  for (const id of identityIds) {
    const key = memoryKeys.get(id);
    if (key) return key;
  }
  try {
    const keys = await readKeys(identityIds.map((id) => `master_key:${id}`));
    const key = keys.find(validKey);
    if (key) {
      for (const id of identityIds) memoryKeys.set(id, key);
      return key;
    }
  } catch {}
  for (const id of identityIds) {
    const key = await importLocalKey(readLocal(`ave_master_key:${id}`));
    if (key) {
      await storeBoundMasterKey(key, identityIds);
      return key;
    }
  }
  return null;
}

export async function loadUnboundMasterKey(): Promise<CryptoKey | null> {
  try {
    const [key] = await readKeys([LEGACY_ID]);
    if (validKey(key)) return key;
  } catch {}
  return importLocalKey(readLocal(LEGACY_LOCAL_KEY));
}

export async function storeBoundMasterKey(key: CryptoKey, identityIds: string[], promoteLegacy = false): Promise<void> {
  if (!identityIds.length || !validKey(key)) throw new Error("An authenticated identity is required to store an encryption key.");
  for (const id of identityIds) memoryKeys.set(id, key);
  try {
    await writeKeys(identityIds, key, promoteLegacy);
    for (const id of identityIds) removeLocal(`ave_master_key:${id}`);
    if (promoteLegacy) removeLocal(LEGACY_LOCAL_KEY);
  } catch {
    try {
      const bytes = new Uint8Array(await crypto.subtle.exportKey("raw", key));
      const value = btoa(String.fromCharCode(...bytes));
      for (const id of identityIds) localStorage.setItem(`ave_master_key:${id}`, value);
      if (promoteLegacy) removeLocal(LEGACY_LOCAL_KEY);
    } catch {}
  }
  removeLocal("ave_master_key_available");
}

export async function clearBoundMasterKey(identityIds: string[]): Promise<void> {
  for (const id of identityIds) {
    memoryKeys.delete(id);
    removeLocal(`ave_master_key:${id}`);
  }
  removeLocal("ave_master_key_available");
  try { await writeKeys(identityIds, null); } catch {}
}
