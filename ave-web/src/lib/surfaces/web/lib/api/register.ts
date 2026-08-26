import { API_BASE, D1_BOOKMARK_HEADER, ApiError, captureBookmark, readStoredBookmark, request } from "./transport";
import type { ActivityLogEntry, Device, Identity, IdentityEncryptionKey, LoginRequest, OAuthAuthorization, Passkey, SessionBootstrap, SignatureRequest } from "./types";

export const registerApi = {
    checkHandle: (handle: string) =>
      request<{ available: boolean; reason?: string }>(
        `/api/register/check-handle/${encodeURIComponent(handle)}`
      ),

    start: (handle: string) =>
      request<{
        options: PublicKeyCredentialCreationOptions;
        tempUserId: string;
      }>("/api/register/start", {
        method: "POST",
        body: JSON.stringify({ handle }),
      }),

    complete: (data: {
      tempUserId: string;
      credential: Credential;
      identity: {
        displayName: string;
        handle: string;
        email?: string;
        birthday?: string;
        avatarUrl?: string;
        bannerUrl?: string;
      };
      device: {
        name: string;
        type: "phone" | "computer" | "tablet";
        browser?: string;
        os?: string;
        fingerprint?: string;
      };
      prfEncryptedMasterKey?: string; // Master key encrypted with PRF output (if passkey supports PRF)
      encryptionKey?: IdentityEncryptionKey;
    }) =>
      request<{
        success: boolean;
        sessionToken: string;
        trustCodes: string[];
        user: { id: string };
        identity: Identity;
        device: Device;
      }>("/api/register/complete", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    finalizeBackup: (encryptedMasterKeyBackup: string) =>
      request<{ success: boolean }>("/api/register/finalize-backup", {
        method: "POST",
        body: JSON.stringify({ encryptedMasterKeyBackup }),
      }),

    getSecurityQuestions: () =>
      request<{ questions: string[] }>("/api/register/security-questions"),
};
