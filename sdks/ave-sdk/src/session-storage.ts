import type { AveSessionSnapshot, AveSessionStorage } from "./session.js";

const STORAGE_KEY = "ave_oauth_session";

function parseSnapshot(raw: string): AveSessionSnapshot | null {
  try {
    const j = JSON.parse(raw) as AveSessionSnapshot;
    if (!j.access_token || !j.access_token_jwt || typeof j.expiresAtMs !== "number") {
      return null;
    }
    return j;
  } catch {
    return null;
  }
}

/**
 * Browser localStorage — development only; avoid for production refresh_token storage.
 */
export function createLocalStorageAdapter(storageKey = STORAGE_KEY): AveSessionStorage {
  return {
    async load() {
      if (typeof localStorage === "undefined") return null;
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        return parseSnapshot(raw);
      } catch {
        return null;
      }
    },
    async save(snapshot) {
      if (typeof localStorage === "undefined") return;
      try {
        if (snapshot === null) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, JSON.stringify(snapshot));
        }
      } catch {
        // ignore quota / private mode
      }
    },
  };
}

export function createMemoryStorage(): AveSessionStorage {
  let data: AveSessionSnapshot | null = null;
  return {
    async load() {
      return data;
    },
    async save(snapshot) {
      data = snapshot;
    },
  };
}

/**
 * Expo SecureStore / any async key-value with compatible shape.
 */
export interface AsyncSecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export function createSecureStoreAdapter(
  store: AsyncSecureStoreLike,
  storageKey = STORAGE_KEY
): AveSessionStorage {
  return {
    async load() {
      const raw = await store.getItemAsync(storageKey);
      if (!raw) return null;
      return parseSnapshot(raw);
    },
    async save(snapshot) {
      if (snapshot === null) {
        await store.deleteItemAsync(storageKey);
        return;
      }
      await store.setItemAsync(storageKey, JSON.stringify(snapshot));
    },
  };
}
