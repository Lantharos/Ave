import { api, ApiError } from "./api";
import { decryptMasterKeyWithPrf, loadMasterKey, storeMasterKey } from "./crypto-vault";
import { createSigningKeyForIdentity, signWithIdentityKey } from "./signing";
import { authenticateWithPasskey } from "./webauthn";
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

export function buildBusinessActionPayload(action: string, details: Record<string, unknown>): string {
  return JSON.stringify({ version: 1, action, details });
}

async function unlockMasterKey(): Promise<CryptoKey> {
  const existing = await loadMasterKey();
  if (existing) return existing;

  const { unlockSessionId, options } = await api.security.unlockMasterKeyStart();
  const { credential, prfOutput } = await authenticateWithPasskey(options);
  if (!prfOutput) throw new Error("This passkey cannot unlock signing keys on this device.");

  const { prfEncryptedMasterKey } = await api.security.unlockMasterKeyFinish({ unlockSessionId, credential });
  const masterKey = await decryptMasterKeyWithPrf(prfEncryptedMasterKey, prfOutput);
  await storeMasterKey(masterKey);
  return masterKey;
}

async function signingKeyForIdentity(identityId: string): Promise<{ publicKey: string; encryptedPrivateKey: string }> {
  const existing = await api.signing.getKey(identityId);
  if (existing.hasKey && existing.publicKey && existing.encryptedPrivateKey) {
    return { publicKey: existing.publicKey, encryptedPrivateKey: existing.encryptedPrivateKey };
  }

  const created = await createSigningKeyForIdentity(await unlockMasterKey());
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
  let signature = await signWithIdentityKey(buildBusinessActionPayload(action, details), key.encryptedPrivateKey);
  if (!signature) {
    await unlockMasterKey();
    signature = await signWithIdentityKey(buildBusinessActionPayload(action, details), key.encryptedPrivateKey);
  }
  if (!signature) throw new Error("Could not sign this organization action.");
  return { signature };
}
