import type { OAuthAuthorization } from "$lib/surfaces/web/lib/api";
import {
  decryptAppKey,
  decryptAppPrivateKey,
  decryptAppPrivateKeyB64,
  encryptAppKey,
  encryptAppPrivateKey,
  exportAppKey,
  exportAppPrivateKeyB64,
  generateAppKey,
  generateAppKeyPair,
  masterKeysMatch,
  resolveActiveMasterKey,
  storeMasterKey,
} from "$lib/surfaces/web/lib/crypto";
import {
  authorizationHasE2eeMaterial,
  resolveE2eeAuthorization,
  type E2eeMode,
} from "$lib/surfaces/web/lib/e2ee-scopes";

type AppEncryptionSupport = {
  supportsE2ee: boolean;
  allowedScopes?: string[];
};

type AuthorizationEncryption = {
  encryptedAppKey?: string;
  appPublicKey?: string;
  encryptedAppPrivateKey?: string;
};

export type RedirectEncryptionMaterial = {
  appKey: string | null;
  appKeyOld: string | null;
  appPublicKey: string | null;
  appPublicKeyOld: string | null;
  appPrivateKey: string | null;
  appPrivateKeyOld: string | null;
  reset: boolean;
};

export type PreparedAuthorizationEncryption =
  | { status: "ready"; authorization: AuthorizationEncryption; redirect: RedirectEncryptionMaterial }
  | { status: "master-key-required" }
  | { status: "master-key-recovery-required" }
  | { status: "error"; message: string };

export async function prepareAuthorizationEncryption(input: {
  requestedScopes: string[];
  app: AppEncryptionSupport;
  existingAuthorization: OAuthAuthorization | null;
  identityId: string;
  sessionMasterKey: CryptoKey | null;
}): Promise<PreparedAuthorizationEncryption> {
  const resolved = resolveE2eeAuthorization(input.requestedScopes, input.app, input.existingAuthorization);
  const emptyRedirect: RedirectEncryptionMaterial = {
    appKey: null,
    appKeyOld: null,
    appPublicKey: null,
    appPublicKeyOld: null,
    appPrivateKey: null,
    appPrivateKeyOld: null,
    reset: resolved.reset,
  };
  if (!resolved.mode) return { status: "ready", authorization: {}, redirect: emptyRedirect };

  const resolvedMasterKey = await resolveActiveMasterKey(input.sessionMasterKey);
  if (!resolvedMasterKey) return { status: "master-key-required" };

  let masterKey = resolvedMasterKey;
  const authorization: AuthorizationEncryption = {};
  const redirect = { ...emptyRedirect };
  const hasStoredMaterial = input.existingAuthorization?.identityId === input.identityId
    && authorizationHasE2eeMaterial(input.existingAuthorization, resolved.mode);

  const loadStoredKeys = async (mode: E2eeMode, key: CryptoKey): Promise<"ok" | "missing" | "failed"> => {
    if (mode === "symmetric") {
      if (!input.existingAuthorization?.encryptedAppKey) return "missing";
      try {
        redirect.appKey = await exportAppKey(await decryptAppKey(input.existingAuthorization.encryptedAppKey, key));
        return "ok";
      } catch {
        return "failed";
      }
    }
    if (mode === "asymmetric") {
      if (!input.existingAuthorization?.appPublicKey || !input.existingAuthorization.encryptedAppPrivateKey) return "missing";
      try {
        redirect.appPublicKey = input.existingAuthorization.appPublicKey;
        redirect.appPrivateKey = await decryptAppPrivateKeyB64(input.existingAuthorization.encryptedAppPrivateKey, key);
        return "ok";
      } catch {
        return "failed";
      }
    }
    return "missing";
  };

  const createAsymmetricMaterial = async () => {
    const keyPair = await generateAppKeyPair();
    const encryptedPrivateKey = await encryptAppPrivateKey(keyPair.privateKey, masterKey);
    await decryptAppPrivateKey(encryptedPrivateKey, masterKey);
    authorization.appPublicKey = keyPair.publicKey;
    authorization.encryptedAppPrivateKey = encryptedPrivateKey;
    redirect.appPublicKey = keyPair.publicKey;
    redirect.appPrivateKey = await exportAppPrivateKeyB64(keyPair.privateKey);
  };

  if (resolved.reset) {
    if (hasStoredMaterial) {
      const prior = await loadStoredKeys(resolved.mode, masterKey);
      if (prior === "ok") {
        redirect.appKeyOld = redirect.appKey;
        redirect.appPublicKeyOld = redirect.appPublicKey;
        redirect.appPrivateKeyOld = redirect.appPrivateKey;
      }
    }
    redirect.appKey = null;
    redirect.appPublicKey = null;
    redirect.appPrivateKey = null;
  } else if (hasStoredMaterial) {
    let loaded = await loadStoredKeys(resolved.mode, masterKey);
    if (loaded === "failed" && input.sessionMasterKey && !(await masterKeysMatch(masterKey, input.sessionMasterKey))) {
      loaded = await loadStoredKeys(resolved.mode, input.sessionMasterKey);
      if (loaded === "ok") masterKey = input.sessionMasterKey;
    }
    if (loaded === "failed") return { status: "master-key-recovery-required" };
    if (loaded === "missing") {
      return { status: "error", message: "This app has saved encryption keys but they could not be loaded. Try again or contact support." };
    }
    await storeMasterKey(masterKey);
    return { status: "ready", authorization, redirect };
  }

  if (resolved.mode === "symmetric") {
    const appKey = await generateAppKey();
    authorization.encryptedAppKey = await encryptAppKey(appKey, masterKey);
    redirect.appKey = await exportAppKey(appKey);
  } else if (resolved.mode === "asymmetric") {
    await createAsymmetricMaterial();
  } else {
    throw new Error(`Encryption mode "${resolved.mode}" is not available yet.`);
  }

  await storeMasterKey(masterKey);
  return { status: "ready", authorization, redirect };
}
