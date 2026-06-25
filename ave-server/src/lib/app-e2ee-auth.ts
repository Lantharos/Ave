import { validateOpaqueKeyEnvelope, validatePublicKeyBlob } from "./encryption-key-payload";
import type { E2eeMode } from "./e2ee-scopes";
import { isImplementedE2eeMode, storedModeToE2eeMode } from "./e2ee-scopes";

export type E2eeAuthPayload = {
  encryptedAppKey?: string;
  appPublicKey?: string;
  encryptedAppPrivateKey?: string;
};

export type StoredE2eeAuth = {
  encryptedAppKey?: string | null;
  appPublicKey?: string | null;
  encryptedAppPrivateKey?: string | null;
  appEncryptionMode?: string | null;
};

export function validateE2eeAuthPayload(
  mode: E2eeMode,
  payload: E2eeAuthPayload,
  existing?: StoredE2eeAuth | null,
  options?: { reset?: boolean },
): string | null {
  if (!isImplementedE2eeMode(mode)) {
    return `Encryption mode "${mode}" is not available yet`;
  }

  if (options?.reset) {
    if (mode === "symmetric") {
      if (!payload.encryptedAppKey) {
        return "E2EE reset requires a new encryptedAppKey";
      }
      const enc = validateOpaqueKeyEnvelope(payload.encryptedAppKey);
      if (!enc.ok) return enc.error;
      return null;
    }

    if (mode === "asymmetric") {
      if (!payload.appPublicKey || !payload.encryptedAppPrivateKey) {
        return "E2EE reset requires new appPublicKey and encryptedAppPrivateKey";
      }
      const pk = validatePublicKeyBlob(payload.appPublicKey);
      if (!pk.ok) return pk.error;
      const enc = validateOpaqueKeyEnvelope(payload.encryptedAppPrivateKey);
      if (!enc.ok) return enc.error;
      return null;
    }

    return `Unsupported encryption mode: ${mode}`;
  }

  if (mode === "symmetric") {
    if (!payload.encryptedAppKey && !existing?.encryptedAppKey) {
      return "E2EE symmetric scope requires encryptedAppKey";
    }
    if (payload.encryptedAppKey) {
      const enc = validateOpaqueKeyEnvelope(payload.encryptedAppKey);
      if (!enc.ok) return enc.error;
    }
    return null;
  }

  if (mode === "asymmetric") {
    const hasExisting =
      !!existing?.appPublicKey && !!existing?.encryptedAppPrivateKey;
    if (!hasExisting) {
      if (!payload.appPublicKey || !payload.encryptedAppPrivateKey) {
        return "E2EE asymmetric scope requires appPublicKey and encryptedAppPrivateKey";
      }
    }
    if (payload.appPublicKey) {
      const pk = validatePublicKeyBlob(payload.appPublicKey);
      if (!pk.ok) return pk.error;
    }
    if (payload.encryptedAppPrivateKey) {
      const enc = validateOpaqueKeyEnvelope(payload.encryptedAppPrivateKey);
      if (!enc.ok) return enc.error;
    }
    return null;
  }

  return `Unsupported encryption mode: ${mode}`;
}

export function buildE2eeAuthUpdate(
  mode: E2eeMode,
  payload: E2eeAuthPayload,
  existing?: StoredE2eeAuth | null,
  options?: { reset?: boolean },
): Partial<StoredE2eeAuth> {
  if (options?.reset) {
    if (mode === "symmetric") {
      return {
        encryptedAppKey: payload.encryptedAppKey ?? null,
        appEncryptionMode: "symmetric",
      };
    }

    if (mode === "asymmetric") {
      return {
        appPublicKey: payload.appPublicKey ?? null,
        encryptedAppPrivateKey: payload.encryptedAppPrivateKey ?? null,
        appEncryptionMode: "asymmetric",
      };
    }

    return { appEncryptionMode: mode };
  }

  if (mode === "symmetric") {
    return {
      encryptedAppKey: payload.encryptedAppKey ?? existing?.encryptedAppKey ?? null,
      appEncryptionMode: "symmetric",
    };
  }

  if (mode === "asymmetric") {
    return {
      appPublicKey: payload.appPublicKey ?? existing?.appPublicKey ?? null,
      encryptedAppPrivateKey:
        payload.encryptedAppPrivateKey ?? existing?.encryptedAppPrivateKey ?? null,
      appEncryptionMode: "asymmetric",
    };
  }

  return { appEncryptionMode: mode };
}

export function hasStoredE2eeMaterial(
  mode: E2eeMode,
  stored?: StoredE2eeAuth | null,
): boolean {
  if (!stored) return false;
  if (mode === "symmetric") return !!stored.encryptedAppKey;
  if (mode === "asymmetric") {
    return !!stored.appPublicKey && !!stored.encryptedAppPrivateKey;
  }
  return false;
}

export function authorizationHasE2eeMaterial(
  stored?: StoredE2eeAuth | null,
  mode?: E2eeMode | null,
): boolean {
  if (!stored) return false;
  const resolved = mode ?? storedModeToE2eeMode(stored.appEncryptionMode);
  if (!resolved) {
    return !!stored.encryptedAppKey || !!stored.appPublicKey;
  }
  return hasStoredE2eeMaterial(resolved, stored);
}
