import { request } from "./transport";
import type { ConnectedApp, OAuthAuthorization, SessionBootstrap } from "./types";

export const oauthApi = {
    getSessionBootstrap: (timeoutMs = 5000) =>
      request<SessionBootstrap>("/api/oauth/session/bootstrap", {
        timeoutMs,
      }),

    getApp: (clientId: string) =>
      request<{
        app: {
          id?: string;
          name: string;
          description?: string;
          iconUrl?: string;
          websiteUrl?: string;
          allowedScopes?: string[];
        };
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
          allowedScopes?: string[];
        };
        authorizations: OAuthAuthorization[];
      }>(`/api/oauth/authorize/bootstrap/${encodeURIComponent(clientId)}${query}`, {
        cache: "no-store",
      });
    },

    authorize: (data: {
      clientId: string;
      redirectUri: string;
      scope: string;
      state?: string;
      identityId: string;
      codeChallenge?: string;
      codeChallengeMethod?: "S256" | "plain";
      encryptedAppKey?: string;
      appPublicKey?: string;
      encryptedAppPrivateKey?: string;
      nonce?: string;
      interactionMode?: "instant" | "prompt";
    }) =>
      request<{ redirectUrl: string }>("/api/oauth/authorize", {
        method: "POST",
        body: JSON.stringify(data),
        timeoutMs: 45000,
      }),

    listConnectedApps: () =>
      request<{ authorizations: ConnectedApp[] }>("/api/oauth/authorizations"),

    revokeConnectedApp: (authorizationId: string) =>
      request<{ success: boolean }>(`/api/oauth/authorizations/${encodeURIComponent(authorizationId)}`, {
        method: "DELETE",
      }),

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
};
