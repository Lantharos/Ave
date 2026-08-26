import { API_BASE, D1_BOOKMARK_HEADER, ApiError, captureBookmark, readStoredBookmark, request } from "./transport";
import type { ActivityLogEntry, Device, Identity, IdentityEncryptionKey, LoginRequest, OAuthAuthorization, Passkey, SessionBootstrap, SignatureRequest } from "./types";

export const securityApi = {
    get: () =>
      request<{
        passkeys: Passkey[];
        trustCodesRemaining: number;
        recoveryCodesRemaining: number;
        hasRecoveryCodes: boolean;
        securityQuestionIds: number[];
      }>("/api/security"),

    issueRecoveryCodes: () =>
      request<{ codes: string[]; trustCodesRemaining: number; recoveryCodesRemaining: number }>(
        "/api/security/trust-codes/issue",
        { method: "POST" }
      ),

    registerPasskey: () =>
      request<{ options: PublicKeyCredentialCreationOptions }>(
        "/api/security/passkeys/register",
        { method: "POST" }
      ),

    completePasskeyRegistration: (credential: Credential, name?: string, prfEncryptedMasterKey?: string) =>
      request<{ passkey: Passkey }>("/api/security/passkeys/complete", {
        method: "POST",
        body: JSON.stringify({ credential, name, prfEncryptedMasterKey }),
      }),

    renamePasskey: (passkeyId: string, name: string) =>
      request<{ success: boolean }>(`/api/security/passkeys/${passkeyId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),

    updatePasskeyPrf: (passkeyId: string, prfEncryptedMasterKey: string) =>
      request<{ success: boolean }>(`/api/security/passkeys/${passkeyId}`, {
        method: "PATCH",
        body: JSON.stringify({ prfEncryptedMasterKey }),
      }),

    deletePasskey: (passkeyId: string) =>
      request<{ success: boolean }>(`/api/security/passkeys/${passkeyId}`, {
        method: "DELETE",
      }),

    regenerateTrustCodes: () =>
      request<{ codes: string[]; trustCodesRemaining: number; recoveryCodesRemaining: number }>(
        "/api/security/trust-codes/regenerate",
        {
        method: "POST",
        }
      ),

    updateSecurityQuestions: (
      questions: { questionId: number; answer: string }[]
    ) =>
      request<{ success: boolean }>("/api/security/questions", {
        method: "PUT",
        body: JSON.stringify({ questions }),
      }),

    unlockMasterKeyStart: () =>
      request<{ unlockSessionId: string; options: PublicKeyCredentialRequestOptions }>(
        "/api/security/master-key/unlock/start",
        { method: "POST" }
      ),

    unlockMasterKeyFinish: (data: { unlockSessionId: string; credential: Credential }) =>
      request<{ prfEncryptedMasterKey: string }>(
        "/api/security/master-key/unlock/finish",
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      ),
};
