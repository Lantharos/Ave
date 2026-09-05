import { ApiError, createAveApiClient } from "$lib/infrastructure/http/ave-api-client";
import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { resolveApiBase } from "./origins";
import type {
  BusinessDomain,
  BusinessEncryptionMode,
  BusinessEncryptionPolicy,
  BusinessIdentity,
  BusinessKey,
  BusinessOrganizationDetail,
  BusinessOrganizationSummary,
  BusinessRole,
  BusinessScope,
  BusinessSsoConnection,
  KmsProvider,
} from "./types";

const API_BASE = resolveApiBase();
const client = createAveApiClient({ baseUrl: API_BASE });
const request = client.request;

type SignedAction = { signedAction: { signature: string } };

export const api = {
  getIdentityEncryptionKey: (identityId: string) =>
    request<{ encryptedPrivateKey?: string | null }>(`/api/encryption/keys/${encodeURIComponent(identityId)}`),

  bootstrap: () =>
    request<{ identities: BusinessIdentity[]; organizations: BusinessOrganizationSummary[] }>(
      "/api/business/organizations/bootstrap",
    ),

  createOrganization: (name: string, ownerIdentityId: string, signedAction: SignedAction["signedAction"]) =>
    request<{ organization: BusinessOrganizationSummary }>("/api/business/organizations", {
      method: "POST",
      body: JSON.stringify({ name, ownerIdentityId, signedAction }),
    }),

  getOrganization: (organizationId: string, options: { includeAudit?: boolean } = {}) => {
    const search = options.includeAudit ? "?includeAudit=true" : "";
    return request<BusinessOrganizationDetail>(`/api/business/organizations/${organizationId}${search}`);
  },

  updateOrganization: (organizationId: string, data: { name?: string; ssoRequired?: boolean } & SignedAction) =>
    request<{ organization: BusinessOrganizationSummary }>(`/api/business/organizations/${organizationId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  uploadOrganizationLogo: (organizationId: string, file: File) => {
    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set("file", file);
    return client.upload<{ logoUrl: string }>("/api/upload/workspace-logo", formData);
  },

  updateEncryptionPolicy: (
    organizationId: string,
    data: {
      mode: BusinessEncryptionMode;
      kmsProvider?: KmsProvider;
      kmsKeyRef?: string;
      kmsKeyVersion?: string;
    } & SignedAction,
  ) =>
    request<{ encryptionPolicy: BusinessEncryptionPolicy }>(`/api/business/organizations/${organizationId}/encryption-policy`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  addIdentity: (
    organizationId: string,
    data: { handle: string; role: BusinessRole; scopes?: BusinessScope[]; signingAuthority?: boolean } & SignedAction,
  ) =>
    request(`/api/business/organizations/${organizationId}/identities`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateIdentity: (
    organizationId: string,
    memberId: string,
    data: { role?: BusinessRole; scopes?: BusinessScope[]; signingAuthority?: boolean } & SignedAction,
  ) =>
    request(`/api/business/organizations/${organizationId}/identities/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  removeIdentity: (organizationId: string, memberId: string, signedAction: SignedAction["signedAction"]) =>
    request(`/api/business/organizations/${organizationId}/identities/${memberId}`, {
      method: "DELETE",
      body: JSON.stringify({ signedAction }),
    }),

  createKey: (
    organizationId: string,
    data: {
      name: string;
      resource?: string;
      encryptionMode?: BusinessEncryptionMode;
      grants: Array<{ identityId: string; encryptedKey: string; senderPublicKey: string; recipientPublicKey: string }>;
    } & SignedAction,
  ) =>
    request<{ key: BusinessKey }>(`/api/business/organizations/${organizationId}/keys`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  rotateKey: (
    organizationId: string,
    keyringId: string,
    data: {
      grants: Array<{ identityId: string; encryptedKey: string; senderPublicKey: string; recipientPublicKey: string }>;
    } & SignedAction,
  ) =>
    request<{ key: BusinessKey }>(`/api/business/organizations/${organizationId}/keys/${keyringId}/rotate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  addDomain: (organizationId: string, domain: string, signedAction: SignedAction["signedAction"]) =>
    request<{ domain: BusinessDomain }>(`/api/business/organizations/${organizationId}/domains`, {
      method: "POST",
      body: JSON.stringify({ domain, signedAction }),
    }),

  verifyDomain: (organizationId: string, domainId: string, signedAction: SignedAction["signedAction"]) =>
    request<{ success: boolean; verifiedDomains: string[] }>(
      `/api/business/organizations/${organizationId}/domains/${domainId}/verify`,
      { method: "POST", body: JSON.stringify({ signedAction }) },
    ),

  createSsoConnection: (
    organizationId: string,
    data: {
      type: "saml" | "oidc";
      name: string;
      provider: string;
      domain: string;
      ssoUrl?: string;
      entityId?: string;
      x509Certificate?: string;
      issuer?: string;
      authorizationEndpoint?: string;
      tokenEndpoint?: string;
      jwksUri?: string;
      clientId?: string;
      clientSecret?: string;
    } & SignedAction,
  ) =>
    request<{ connection: BusinessSsoConnection }>(`/api/business/organizations/${organizationId}/sso-connections`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  ssoStartUrl: (type: "saml" | "oidc", connectionId: string, mode: "test" | "login" = "test") =>
    `${API_BASE}/api/business/sso/${type}/${connectionId}/start?mode=${mode}`,

  security: {
    unlockMasterKeyStart: () =>
      request<{ unlockSessionId: string; options: PublicKeyCredentialRequestOptionsJSON }>(
        "/api/security/master-key/unlock/start",
        { method: "POST" },
      ),
    unlockMasterKeyFinish: (data: { unlockSessionId: string; credential: AuthenticationResponseJSON }) =>
      request<{ prfEncryptedMasterKey: string; identityIds: string[] }>("/api/security/master-key/unlock/finish", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  signing: {
    getKey: (identityId: string) =>
      request<{ hasKey: boolean; publicKey: string | null; encryptedPrivateKey: string | null; createdAt?: string }>(
        `/api/signing/keys/${identityId}`,
      ),
    createKey: (identityId: string, publicKey: string, encryptedPrivateKey: string) =>
      request<{ success: boolean; publicKey: string; createdAt: string }>(`/api/signing/keys/${identityId}`, {
        method: "POST",
        body: JSON.stringify({ publicKey, encryptedPrivateKey }),
      }),
  },
};

export { ApiError };
