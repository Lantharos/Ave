import { API_BASE, D1_BOOKMARK_HEADER, ApiError, captureBookmark, readStoredBookmark, request } from "./transport";
import type { ActivityLogEntry, Device, Identity, IdentityEncryptionKey, LoginRequest, OAuthAuthorization, Passkey, SessionBootstrap, SignatureRequest } from "./types";

export const uploadApi = {
    avatar: async (identityId: string, file: File) => {
      let token: string | null = null;
      try {
        token = localStorage.getItem("ave_session_token");
      } catch {
        token = null;
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("identityId", identityId);

      const response = await fetch(`${API_BASE}/api/upload/avatar`, {
        method: "POST",
        headers: (() => {
          const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
          const bookmark = readStoredBookmark();
          if (bookmark) {
            headers[D1_BOOKMARK_HEADER] = bookmark;
          }
          return headers;
        })(),
        body: formData,
        credentials: "include",
      });

      captureBookmark(response);

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new ApiError(response.status, data.error || "Upload failed");
      }

      return response.json() as Promise<{ avatarUrl: string }>;
    },

    banner: async (identityId: string, file: File) => {
      let token: string | null = null;
      try {
        token = localStorage.getItem("ave_session_token");
      } catch {
        token = null;
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("identityId", identityId);

      const response = await fetch(`${API_BASE}/api/upload/banner`, {
        method: "POST",
        headers: (() => {
          const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
          const bookmark = readStoredBookmark();
          if (bookmark) {
            headers[D1_BOOKMARK_HEADER] = bookmark;
          }
          return headers;
        })(),
        body: formData,
        credentials: "include",
      });

      captureBookmark(response);

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new ApiError(response.status, data.error || "Upload failed");
      }

      return response.json() as Promise<{ bannerUrl: string }>;
    },

    deleteAvatar: (identityId: string) =>
      request<{ success: boolean }>(`/api/upload/avatar/${identityId}`, {
        method: "DELETE",
      }),

    deleteBanner: (identityId: string) =>
      request<{ success: boolean }>(`/api/upload/banner/${identityId}`, {
        method: "DELETE",
      }),
};
