import { API_BASE, D1_BOOKMARK_HEADER, ApiError, captureBookmark, readStoredBookmark, request } from "./transport";
import type { ActivityLogEntry, Device, Identity, IdentityEncryptionKey, LoginRequest, OAuthAuthorization, Passkey, SessionBootstrap, SignatureRequest } from "./types";

export const activityApi = {
    list: (params?: {
      limit?: number;
      offset?: number;
      action?: string;
      severity?: "info" | "warning" | "danger";
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.offset) searchParams.set("offset", String(params.offset));
      if (params?.action) searchParams.set("action", params.action);
      if (params?.severity) searchParams.set("severity", params.severity);

      const query = searchParams.toString();
      return request<{ logs: ActivityLogEntry[] }>(
        `/api/activity${query ? `?${query}` : ""}`
      );
    },
};
