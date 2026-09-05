import type { AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON } from "@simplewebauthn/browser";
import { request } from "./transport";
import type { Passkey } from "./types";

export const securityApi = {
    get: () =>
      request<{
        passkeys: Passkey[];
        trustCodesRemaining: number;
        recoveryCodesRemaining: number;
        hasRecoveryCodes: boolean;
      }>("/api/security"),

    issueRecoveryCodes: () =>
      request<{ codes: string[]; trustCodesRemaining: number; recoveryCodesRemaining: number }>(
        "/api/security/trust-codes/issue",
        { method: "POST" }
      ),

    registerPasskey: () =>
      request<{ options: PublicKeyCredentialCreationOptionsJSON }>(
        "/api/security/passkeys/register",
        { method: "POST" }
      ),

    completePasskeyRegistration: (credential: RegistrationResponseJSON, name?: string, prfEncryptedMasterKey?: string) =>
      request<{ passkey: Passkey }>("/api/security/passkeys/complete", {
        method: "POST",
        body: JSON.stringify({ credential, name, prfEncryptedMasterKey }),
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

    unlockMasterKeyStart: () =>
      request<{ unlockSessionId: string; options: PublicKeyCredentialRequestOptionsJSON }>(
        "/api/security/master-key/unlock/start",
        { method: "POST" }
      ),

    unlockMasterKeyFinish: (data: { unlockSessionId: string; credential: AuthenticationResponseJSON }) =>
      request<{ prfEncryptedMasterKey: string; identityIds: string[] }>(
        "/api/security/master-key/unlock/finish",
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      ),
};
