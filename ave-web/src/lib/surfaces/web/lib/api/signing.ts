import { request } from "./transport";

export const signingApi = {

    // Get signing key for a specific identity
    getKey: (identityId: string) =>
      request<{
        hasKey: boolean;
        publicKey: string | null;
        encryptedPrivateKey: string | null;
        createdAt?: string;
      }>(`/api/signing/keys/${identityId}`),

    // Store a new signing key
    createKey: (identityId: string, publicKey: string, encryptedPrivateKey: string) =>
      request<{
        success: boolean;
        publicKey: string;
        createdAt: string;
      }>(`/api/signing/keys/${identityId}`, {
        method: "POST",
        body: JSON.stringify({ publicKey, encryptedPrivateKey }),
      }),

    // Get a specific signature request
    getRequest: (requestId: string) =>
      request<{
        request: {
          id: string;
          payload: string;
          metadata?: Record<string, unknown>;
          status: string;
          createdAt: string;
          expiresAt: string;
          signature?: string;
          resolvedAt?: string;
        };
        app: {
          id: string;
          name: string;
          iconUrl?: string;
          websiteUrl?: string;
        };
        identity: {
          id: string;
          handle: string;
          displayName: string;
          avatarUrl?: string | null;
        };
        signingKey: {
          publicKey: string;
          encryptedPrivateKey: string;
        } | null;
      }>(`/api/signing/requests/${requestId}`),

    // Submit a signature
    sign: (requestId: string, signature: string) =>
      request<{ success: boolean; signature: string }>(`/api/signing/requests/${requestId}/sign`, {
        method: "POST",
        body: JSON.stringify({ signature }),
      }),

    // Deny a signature request
    deny: (requestId: string) =>
      request<{ success: boolean }>(`/api/signing/requests/${requestId}/deny`, {
        method: "POST",
      }),

    // Get public key by handle (public endpoint)
    getPublicKey: (handle: string) =>
      request<{
        handle: string;
        publicKey: string;
        createdAt: string;
      }>(`/api/signing/public-key/${encodeURIComponent(handle)}`),

    // Verify a signature (public endpoint)
    verify: (message: string, signature: string, publicKey: string) =>
      request<{ valid: boolean; error?: string }>("/api/signing/verify", {
        method: "POST",
        body: JSON.stringify({ message, signature, publicKey }),
      }),
};
