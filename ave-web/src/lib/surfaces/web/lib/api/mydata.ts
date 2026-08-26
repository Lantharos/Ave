import { API_BASE, D1_BOOKMARK_HEADER, ApiError, captureBookmark, readStoredBookmark, request } from "./transport";
import type { ActivityLogEntry, Device, Identity, IdentityEncryptionKey, LoginRequest, OAuthAuthorization, Passkey, SessionBootstrap, SignatureRequest } from "./types";

export const mydataApi = {
    export: async () => {
      let token: string | null = null;
      try {
        token = localStorage.getItem("ave_session_token");
      } catch {
        token = null;
      }
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const bookmark = readStoredBookmark();
      if (bookmark) {
        headers[D1_BOOKMARK_HEADER] = bookmark;
      }

      const response = await fetch(`${API_BASE}/api/mydata/export`, {
        headers,
        credentials: "include",
      });

      captureBookmark(response);


      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new ApiError(response.status, data.error || "Export failed");
      }

      // Return as blob for download
      return response.blob();
    },

    delete: () =>
      request<{ success: boolean; message: string }>("/api/mydata", {
        method: "DELETE",
      }),
};
