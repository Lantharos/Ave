import { loadBoundMasterKey, loadUnboundMasterKey, storeBoundMasterKey } from "$lib/infrastructure/browser/master-key-storage";
import { decrypt } from "$lib/infrastructure/crypto/core";
import { decryptMasterKeyWithPrf } from "$lib/infrastructure/crypto/master-key";
import { authenticateWithPasskey } from "$lib/infrastructure/webauthn/passkeys";
import { api, ApiError } from "./api";
import { createSigningKeyForIdentity, signWithIdentityKey } from "./signing";
import type { BusinessRole, BusinessScope } from "./types";

const defaultScopesByRole: Record<BusinessRole, BusinessScope[]> = {
  owner: ["read", "sign", "approve", "manage_identities", "manage_keys", "manage_sso", "manage_org"],
  admin: ["read", "sign", "approve", "manage_identities", "manage_keys", "manage_sso"],
  signer: ["read", "sign", "approve"],
  member: ["read"],
  viewer: ["read"],
};

const allowedScopes = new Set<BusinessScope>(["read", "sign", "approve", "manage_identities", "manage_keys", "manage_sso", "manage_org"]);

export function scopesForRole(role: BusinessRole, scopes?: BusinessScope[] | null): BusinessScope[] {
  const normalized = (scopes?.length ? scopes : defaultScopesByRole[role]).filter((scope) => allowedScopes.has(scope));
  return [...new Set<BusinessScope>(normalized.length ? normalized : ["read"])];
}

function buildBusinessActionPayload(action: string, details: Record<string, unknown>): string {
  return JSON.stringify({ version: 1, action, details });
}

async function unlockMasterKey(identityId: string, encryptedPrivateKey?: string, force = false): Promise<CryptoKey> {
  const existing = force ? null : await loadBoundMasterKey([identityId]);
  if (existing) return existing;
  const candidate = force ? null : await loadUnboundMasterKey();
  if (candidate) {
    const proof = encryptedPrivateKey ?? (await api.getIdentityEncryptionKey(identityId)).encryptedPrivateKey;
    try {
      if (!proof) throw new Error("No encryption key is available to verify this account.");
      await decrypt(proof, candidate);
      await storeBoundMasterKey(candidate, [identityId], true);
      return candidate;
    } catch {}
  }

  const { unlockSessionId, options } = await api.security.unlockMasterKeyStart();
  const { credential, prfOutput } = await authenticateWithPasskey(options);
  if (!prfOutput) throw new Error("This passkey cannot unlock signing keys on this device.");

  const { prfEncryptedMasterKey, identityIds } = await api.security.unlockMasterKeyFinish({ unlockSessionId, credential });
  if (!identityIds.includes(identityId)) throw new Error("Your account changed. Reload Ave and unlock again.");
  const masterKey = await decryptMasterKeyWithPrf(prfEncryptedMasterKey, prfOutput);
  await storeBoundMasterKey(masterKey, [identityId]);
  return masterKey;
}

async function signingKeyForIdentity(identityId: string): Promise<{ publicKey: string; encryptedPrivateKey: string }> {
  const existing = await api.signing.getKey(identityId);
  if (existing.hasKey && existing.publicKey && existing.encryptedPrivateKey) {
    return { publicKey: existing.publicKey, encryptedPrivateKey: existing.encryptedPrivateKey };
  }

  const created = await createSigningKeyForIdentity(await unlockMasterKey(identityId));
  try {
    await api.signing.createKey(identityId, created.publicKey, created.encryptedPrivateKey);
    return created;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 409) throw err;
    const refreshed = await api.signing.getKey(identityId);
    if (!refreshed.publicKey || !refreshed.encryptedPrivateKey) throw err;
    return { publicKey: refreshed.publicKey, encryptedPrivateKey: refreshed.encryptedPrivateKey };
  }
}

export async function signBusinessAction(identityId: string, action: string, details: Record<string, unknown>): Promise<{ signature: string }> {
  const key = await signingKeyForIdentity(identityId);
  const payload = buildBusinessActionPayload(action, details);
  const masterKey = await unlockMasterKey(identityId, key.encryptedPrivateKey);
  let signature: string;
  try {
    signature = await signWithIdentityKey(payload, key.encryptedPrivateKey, masterKey);
  } catch {
    const recovered = await unlockMasterKey(identityId, undefined, true);
    signature = await signWithIdentityKey(payload, key.encryptedPrivateKey, recovered);
  }
  return { signature };
}
