import { API_BASE, D1_BOOKMARK_HEADER, ApiError, captureBookmark, readStoredBookmark, request } from "./transport";
import type { ActivityLogEntry, Device, Identity, IdentityEncryptionKey, LoginRequest, OAuthAuthorization, Passkey, SessionBootstrap, SignatureRequest } from "./types";

export const identitiesApi = {
    list: () =>
      request<SessionBootstrap>("/api/identities"),

    get: (identityId: string) =>
      request<{ identity: Identity }>(`/api/identities/${identityId}`),

    create: (data: {
      displayName: string;
      handle: string;
      email?: string;
      birthday?: string;
      avatarUrl?: string;
      bannerUrl?: string;
      encryptionKey?: IdentityEncryptionKey;
    }) =>
      request<{ identity: Identity }>("/api/identities", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (identityId: string, data: Partial<{
      displayName: string;
      handle: string;
      birthday: string | null;
      avatarUrl: string | null;
      bannerUrl: string | null;
    }>) =>
      request<{ identity: Identity }>(`/api/identities/${identityId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    startEmailVerification: (identityId: string, email: string) =>
      request<{ success: boolean; identity: Identity }>(`/api/identities/${identityId}/email/start`, {
        method: "POST",
        body: JSON.stringify({ email }),
      }),

    verifyEmail: (identityId: string, code: string) =>
      request<{ success: boolean; identity: Identity }>(`/api/identities/${identityId}/email/verify`, {
        method: "POST",
        body: JSON.stringify({ code }),
      }),

    resendEmailVerification: (identityId: string) =>
      request<{ success: boolean; identity: Identity }>(`/api/identities/${identityId}/email/resend`, {
        method: "POST",
      }),

    clearEmail: (identityId: string) =>
      request<{ success: boolean; identity: Identity }>(`/api/identities/${identityId}/email`, {
        method: "DELETE",
      }),

    setPrimary: (identityId: string) =>
      request<{ success: boolean }>(`/api/identities/${identityId}/set-primary`, {
        method: "POST",
      }),

    delete: (identityId: string) =>
      request<{ success: boolean }>(`/api/identities/${identityId}`, {
        method: "DELETE",
      }),
};
