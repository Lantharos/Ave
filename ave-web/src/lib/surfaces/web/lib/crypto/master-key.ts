import { masterKeysMatch } from "$lib/infrastructure/crypto/master-key";

import { clearBoundMasterKey, loadBoundMasterKey, storeBoundMasterKey } from "$lib/infrastructure/browser/master-key-storage";

let activeIdentityIds: string[] = [];

export function selectMasterKeyAccount(identityIds: string[]): void {
  activeIdentityIds = [...identityIds];
}

export function storeMasterKey(masterKey: CryptoKey, identityIds = activeIdentityIds): Promise<void> {
  return storeBoundMasterKey(masterKey, identityIds);
}

export function loadMasterKey(): Promise<CryptoKey | null> {
  return loadBoundMasterKey(activeIdentityIds);
}

export async function clearMasterKey(): Promise<void> {
  const identityIds = activeIdentityIds;
  activeIdentityIds = [];
  await clearBoundMasterKey(identityIds);
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
