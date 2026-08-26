import { API_BASE, D1_BOOKMARK_HEADER, ApiError, captureBookmark, readStoredBookmark, request } from "./transport";
import type { ActivityLogEntry, Device, Identity, IdentityEncryptionKey, LoginRequest, OAuthAuthorization, Passkey, SessionBootstrap, SignatureRequest } from "./types";

export const loginApi = {
    discoverSso: (email: string) =>
      request<{
        ssoRequired: boolean;
        loginAvailable: boolean;
        loginUrl?: string | null;
        organization?: { id: string; name: string };
      }>("/api/business/sso/discover", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),

    ssoUrl: (loginUrl: string, returnTo: string) => {
      const url = new URL(loginUrl, API_BASE);
      url.searchParams.set("return_to", returnTo);
      return url.toString();
    },

    start: (handle: string) =>
      request<{
        userId: string;
        identity: Identity;
        hasDevices: boolean;
        hasPasskeys: boolean;
        demoPasswordEnabled?: boolean;
        authOptions?: PublicKeyCredentialRequestOptions;
        authSessionId?: string;
      }>("/api/login/start", {
        method: "POST",
        body: JSON.stringify({ handle }),
      }),

    demo: (data: {
      handle: string;
      password: string;
      device: {
        name: string;
        type: "phone" | "computer" | "tablet";
        browser?: string;
        os?: string;
        fingerprint?: string;
      };
    }) =>
      request<{
        success: boolean;
        sessionToken: string;
        device: Device;
        identities: Identity[];
        readOnly: boolean;
      }>("/api/login/demo", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    passkey: (data: {
      authSessionId: string;
      credential: Credential;
      device: {
        name: string;
        type: "phone" | "computer" | "tablet";
        browser?: string;
        os?: string;
        fingerprint?: string;
      };
    }) =>
      request<{
        success: boolean;
        sessionToken: string;
        device: Device;
        identities: Identity[];
        needsMasterKey: boolean;
        prfEncryptedMasterKey?: string; // PRF-encrypted master key (if passkey has PRF support)
      }>("/api/login/passkey", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    requestApproval: (data: {
      handle: string;
      requesterPublicKey: string;
      device: {
        name: string;
        type: "phone" | "computer" | "tablet";
        browser?: string;
        os?: string;
        fingerprint?: string;
      };
    }) =>
      request<{
        requestId: string;
        expiresAt: string;
      }>("/api/login/request-approval", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    checkRequestStatus: (requestId: string) =>
      request<{
        status: "pending" | "approved" | "denied" | "expired";
        sessionToken?: string;
        encryptedMasterKey?: string;
        approverPublicKey?: string;
        device?: Device;
        identities?: Identity[];
      }>(`/api/login/request-status/${requestId}`),


    trustCode: (data: {
      handle: string;
      code: string;
      device: {
        name: string;
        type: "phone" | "computer" | "tablet";
        browser?: string;
        os?: string;
        fingerprint?: string;
      };
    }) =>
      request<{
        success: boolean;
        sessionToken: string;
        encryptedMasterKeyBackup?: string;
        device: Device;
        identities: Identity[];
        remainingTrustCodes: number;
        remainingRecoveryCodes: number;
      }>("/api/login/trust-code", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    logout: () =>
      request<{ success: boolean }>("/api/login/logout", {
        method: "POST",
      }),

    recoverKey: (data: { handle: string; code: string }) =>
      request<{
        success: boolean;
        encryptedMasterKeyBackup: string;
        remainingTrustCodes: number;
        remainingRecoveryCodes: number;
      }>("/api/login/recover-key", {
        method: "POST",
        body: JSON.stringify(data),
      }),
};
