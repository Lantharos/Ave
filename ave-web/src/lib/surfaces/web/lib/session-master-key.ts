import { api, type Identity } from "./api";
import { loadBoundMasterKey, loadUnboundMasterKey, storeBoundMasterKey } from "$lib/infrastructure/browser/master-key-storage";
import { loadIdentityEncryptionPrivateKey } from "./crypto/app-keys";

export async function resolveSessionMasterKey(identities: Identity[], preferredKey?: CryptoKey): Promise<CryptoKey | null> {
  const identityIds = identities.map((identity) => identity.id);
  if (!identityIds.length) return null;
  if (preferredKey) {
    await storeBoundMasterKey(preferredKey, identityIds);
    return preferredKey;
  }
  const boundKey = await loadBoundMasterKey(identityIds);
  if (boundKey) return boundKey;

  const candidate = await loadUnboundMasterKey();
  if (!candidate) return null;
  for (const identity of identities) {
    if (identity.hasEncryptionKey === false) continue;
    try {
      const encryption = await api.encryption.getKey(identity.id);
      if (!encryption.encryptedPrivateKey) continue;
      await loadIdentityEncryptionPrivateKey(encryption.encryptedPrivateKey, candidate);
      await storeBoundMasterKey(candidate, identityIds, true);
      return candidate;
    } catch {}
  }
  return null;
}
