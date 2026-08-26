import { request } from "./transport";
import type { ActivityLogEntry, Device, Identity, IdentityEncryptionKey, LoginRequest, OAuthAuthorization, Passkey, SessionBootstrap, SignatureRequest } from "./types";

export const oauthApi = {
    getSessionBootstrap: (timeoutMs = 5000) =>
      request<SessionBootstrap>("/api/oauth/session/bootstrap", {
        timeoutMs,
      }),

    fedcmFinalize: (data: {
      code: string;
      clientId: string;
      state?: string;
      appKey?: string;
      appPublicKey?: string;
      appPrivateKey?: string;
      appKeyOld?: string;
      appPublicKeyOld?: string;
      appPrivateKeyOld?: string;
      appKeyReset?: boolean;
    }) =>
      request<{ assertion: string }>("/api/oauth/fedcm/finalize", {
        method: "POST",
        body: JSON.stringify(data),
        timeoutMs: 30000,
      }),

    getApp: (clientId: string) =>
      request<{
        app: {
          id?: string;
          name: string;
          description?: string;
          iconUrl?: string;
          websiteUrl?: string;
          supportsE2ee: boolean;
        allowedScopes?: string[];
      };
        resources?: {
          resourceKey: string;
          displayName: string;
          description?: string;
          scopes: string[];
          audience: string;
          status: string;
        }[];
      }>(`/api/oauth/app/${encodeURIComponent(clientId)}`, { publicRequest: true }),

    getAuthorizeBootstrap: (clientId: string, identityId?: string) => {
      const query = identityId ? `?identity_id=${encodeURIComponent(identityId)}` : "";
      return request<{
        app: {
          id?: string;
          name: string;
          description?: string;
          iconUrl?: string;
          websiteUrl?: string;
          supportsE2ee: boolean;
        allowedScopes?: string[];
      };
        resources?: {
          resourceKey: string;
          displayName: string;
          description?: string;
          scopes: string[];
          audience: string;
          status: string;
        }[];
        authorizations: OAuthAuthorization[];
      }>(`/api/oauth/authorize/bootstrap/${encodeURIComponent(clientId)}${query}`, {
        cache: "no-store",
      });
    },

    getResource: (resourceKey: string) =>
      request<{
        resource: {
          resourceKey: string;
          displayName: string;
          description?: string;
          scopes: string[];
          audience: string;
          status: string;
          ownerAppClientId: string;
          ownerAppName: string;
          ownerAppDescription?: string;
          ownerAppIconUrl?: string;
          ownerAppWebsiteUrl?: string;
        };
      }>(`/api/oauth/resource/${encodeURIComponent(resourceKey)}`, { publicRequest: true }),

    authorize: (data: {
      clientId: string;
      redirectUri: string;
      scope: string;
      state?: string;
      identityId: string;
      organizationId?: string;
      codeChallenge?: string;
      codeChallengeMethod?: "S256" | "plain";
      encryptedAppKey?: string;
      appPublicKey?: string;
      encryptedAppPrivateKey?: string;
      nonce?: string;
      connector?: boolean;
      requestedResource?: string;
      requestedScope?: string;
      communicationMode?: "user_present" | "background";
      interactionMode?: "instant" | "prompt";
    }) =>
      request<{ redirectUrl: string }>("/api/oauth/authorize", {
        method: "POST",
        body: JSON.stringify(data),
        timeoutMs: 45000,
      }),


    getAuthorization: (clientId: string) =>
      request<{
        authorization: OAuthAuthorization | null;
      }>(`/api/oauth/authorization/${encodeURIComponent(clientId)}`),

    recoverSymmetricAppKey: (data: {
      clientId: string;
      identityId: string;
      encryptedAppKey: string;
      confirmRecovery: true;
    }) =>
      request<{ success: true }>(
        `/api/oauth/authorization/${encodeURIComponent(data.clientId)}/encryption-key`,
        {
          method: "PUT",
          body: JSON.stringify({
            identityId: data.identityId,
            encryptedAppKey: data.encryptedAppKey,
            confirmRecovery: data.confirmRecovery,
          }),
        },
      ),

    getAuthorizations: () =>
      request<{
        authorizations: {
          id: string;
          appId: string;
          identityId: string;
          createdAt: string;
          appName: string;
          appIcon?: string;
          appWebsite?: string;
        }[];
      }>("/api/oauth/authorizations"),

    revokeAuthorization: (authId: string) =>
      request<{ success: boolean }>(`/api/oauth/authorizations/${authId}`, {
        method: "DELETE",
      }),

    getDelegations: () =>
      request<{
        delegations: {
          id: string;
          createdAt: string;
          updatedAt: string;
          revokedAt?: string | null;
          communicationMode: "user_present" | "background";
          scope: string;
          sourceAppClientId: string;
          sourceAppName: string;
          sourceAppIconUrl?: string;
          sourceAppWebsiteUrl?: string;
          targetResourceKey: string;
          targetResourceName: string;
          targetAudience: string;
        }[];
      }>("/api/oauth/delegations"),

    revokeDelegation: (delegationId: string) =>
      request<{ success: boolean }>(`/api/oauth/delegations/${delegationId}`, {
        method: "DELETE",
      }),
};
