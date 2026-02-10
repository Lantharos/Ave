type StoredChallenge<T> = {
  value: T;
  expiresAt: number;
};

let durableStorage: DurableObjectStorage | null = null;
const memoryFallback = new Map<string, StoredChallenge<unknown>>();

function key(namespace: string, id: string): string {
  return `challenge:${namespace}:${id}`;
}

export function initChallengeStorage(storage: DurableObjectStorage): void {
  durableStorage = storage;
}

export async function setChallenge<T>(
  namespace: string,
  id: string,
  value: T,
  ttlMs: number
): Promise<void> {
  const record: StoredChallenge<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
  };

  const storageKey = key(namespace, id);
  if (durableStorage) {
    await durableStorage.put(storageKey, record);
    return;
  }

  memoryFallback.set(storageKey, record as StoredChallenge<unknown>);
}

export async function getChallenge<T>(namespace: string, id: string): Promise<T | null> {
  const storageKey = key(namespace, id);
  let record: StoredChallenge<T> | null = null;

  if (durableStorage) {
    record = (await durableStorage.get<StoredChallenge<T>>(storageKey)) ?? null;
  } else {
    record = (memoryFallback.get(storageKey) as StoredChallenge<T> | undefined) ?? null;
  }

  if (!record) return null;

  if (Date.now() > record.expiresAt) {
    await deleteChallenge(namespace, id);
    return null;
  }

  return record.value;
}

export async function deleteChallenge(namespace: string, id: string): Promise<void> {
  const storageKey = key(namespace, id);
  if (durableStorage) {
    await durableStorage.delete(storageKey);
    return;
  }

  memoryFallback.delete(storageKey);
}
