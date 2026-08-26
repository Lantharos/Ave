import { request } from "./transport";
import type { ActivityLogEntry, Device, Identity, IdentityEncryptionKey, LoginRequest, OAuthAuthorization, Passkey, SessionBootstrap, SignatureRequest } from "./types";

export const encryptionApi = {
    getPublicKey: (handle: string) =>
      request<{
        identityId: string;
        handle: string;
        publicKey: string;
        createdAt: string;
      }>(`/api/encryption/public-key/${encodeURIComponent(handle)}`),

    getKey: (identityId: string) =>
      request<{
        hasKey: boolean;
        publicKey?: string | null;
        encryptedPrivateKey?: string | null;
        createdAt?: string | null;
      }>(`/api/encryption/keys/${identityId}`, {
        timeoutMs: 30000,
      }),

    createKey: (identityId: string, payload: IdentityEncryptionKey) =>
      request<{ success: boolean; publicKey: string; createdAt: string }>(`/api/encryption/keys/${identityId}`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    rotateKey: (identityId: string, payload: IdentityEncryptionKey) =>
      request<{ success: boolean }>(`/api/encryption/keys/${identityId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
};
