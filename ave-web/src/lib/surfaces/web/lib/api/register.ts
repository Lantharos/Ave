import type { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from "@simplewebauthn/browser";
import { request } from "./transport";
import type { Identity, IdentityEncryptionKey, LoginSession } from "./types";

export const registerApi = {
    checkHandle: (handle: string) =>
      request<{ available: boolean; reason?: string }>(
        `/api/register/check-handle/${encodeURIComponent(handle)}`
      ),

    start: (handle: string) =>
      request<{
        options: PublicKeyCredentialCreationOptionsJSON;
        tempUserId: string;
      }>("/api/register/start", {
        method: "POST",
        body: JSON.stringify({ handle }),
      }),

    complete: (data: {
      tempUserId: string;
      credential: RegistrationResponseJSON;
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
        trustCodes: string[];
        user: { id: string };
        identity: Identity;
        device: LoginSession["device"];
      }>("/api/register/complete", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    finalizeBackup: (encryptedMasterKeyBackup: string) =>
      request<{ success: boolean }>("/api/register/finalize-backup", {
        method: "POST",
        body: JSON.stringify({ encryptedMasterKeyBackup }),
      }),
};
