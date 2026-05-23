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
import { resolveApiBase } from "./origins";

const API_BASE = resolveApiBase();
const D1_BOOKMARK_HEADER = "x-d1-bookmark";
let d1Bookmark: string | null = null;

type SignedAction = { signedAction: { signature: string } };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function readBookmark() {
  if (d1Bookmark) return d1Bookmark;
  try {
    d1Bookmark = sessionStorage.getItem("ave_d1_bookmark");
  } catch {
    d1Bookmark = null;
  }
  return d1Bookmark;
}

function saveBookmark(value: string | null) {
  d1Bookmark = value;
  try {
    if (value) sessionStorage.setItem("ave_d1_bookmark", value);
    else sessionStorage.removeItem("ave_d1_bookmark");
  } catch {
  }
}

function captureBookmark(response: Response) {
  const nextBookmark = response.headers.get(D1_BOOKMARK_HEADER);
  if (nextBookmark) saveBookmark(nextBookmark);
  if (response.status === 401) saveBookmark(null);
}

async function readResponseData(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function errorMessage(data: unknown, fallback = "Request failed") {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") return data.error;
  return fallback;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const bookmark = readBookmark();
  if (bookmark) headers.set(D1_BOOKMARK_HEADER, bookmark);

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers,
  });

  captureBookmark(response);

  const data = await readResponseData(response);
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(data));
  }
  return data as T;
}

async function upload<T>(endpoint: string, formData: FormData): Promise<T> {
  const headers = new Headers();
  const bookmark = readBookmark();
  if (bookmark) headers.set(D1_BOOKMARK_HEADER, bookmark);

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: formData,
  });

  captureBookmark(response);

  const data = await readResponseData(response);
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(data, "Upload failed"));
  }
  return data as T;
}

export const api = {
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
    return upload<{ logoUrl: string }>("/api/upload/workspace-logo", formData);
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
      domain?: string;
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
      request<{ unlockSessionId: string; options: PublicKeyCredentialRequestOptions }>(
        "/api/security/master-key/unlock/start",
        { method: "POST" },
      ),
    unlockMasterKeyFinish: (data: { unlockSessionId: string; credential: Credential }) =>
      request<{ prfEncryptedMasterKey: string }>("/api/security/master-key/unlock/finish", {
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
