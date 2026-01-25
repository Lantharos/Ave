/**
 * API client for Ave backend
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("ave_session_token");
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new ApiError(response.status, data.error || "Request failed");
  }
  
  return data as T;
}

// Auth types
export interface Identity {
  id: string;
  displayName: string;
  handle: string;
  email?: string;
  birthday?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  isPrimary: boolean;
}

export interface Device {
  id: string;
  name: string;
  type: "phone" | "computer" | "tablet";
  browser?: string;
  os?: string;
  lastSeenAt?: string;
  isActive: boolean;
  isCurrent?: boolean;
}

export interface Passkey {
  id: string;
  name?: string;
  createdAt: string;
  lastUsedAt?: string;
  deviceType?: string;
}

export interface LoginRequest {
  id: string;
  deviceName?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
  requesterPublicKey: string;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  details?: Record<string, unknown>;
  severity?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface SignatureRequest {
  id: string;
  payload: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  app: {
    id: string;
    name: string;
    iconUrl?: string;
    websiteUrl?: string;
  };
  identity: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

// Registration
export const api = {
  register: {
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
  },
  
  login: {
    start: (handle: string) =>
      request<{
        userId: string;
        identity: Identity;
        hasDevices: boolean;
        hasPasskeys: boolean;
        authOptions?: PublicKeyCredentialRequestOptions;
        authSessionId?: string;
      }>("/api/login/start", {
        method: "POST",
        body: JSON.stringify({ handle }),
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
      }>("/api/login/recover-key", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  
  devices: {
    list: () =>
      request<{ devices: Device[] }>("/api/devices"),
    
    getPendingRequests: () =>
      request<{ requests: LoginRequest[] }>("/api/devices/pending-requests"),
    
    approveRequest: (requestId: string, encryptedMasterKey: string, approverPublicKey?: string) =>
      request<{ success: boolean }>("/api/devices/approve-request", {
        method: "POST",
        body: JSON.stringify({ requestId, encryptedMasterKey, approverPublicKey }),
      }),

    
    denyRequest: (requestId: string) =>
      request<{ success: boolean }>("/api/devices/deny-request", {
        method: "POST",
        body: JSON.stringify({ requestId }),
      }),
    
    rename: (deviceId: string, name: string) =>
      request<{ success: boolean }>(`/api/devices/${deviceId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    
    revoke: (deviceId: string) =>
      request<{ success: boolean }>(`/api/devices/${deviceId}`, {
        method: "DELETE",
      }),
  },
  
  identities: {
    list: () =>
      request<{ identities: Identity[] }>("/api/identities"),
    
    get: (identityId: string) =>
      request<{ identity: Identity }>(`/api/identities/${identityId}`),
    
    create: (data: {
      displayName: string;
      handle: string;
      email?: string;
      birthday?: string;
      avatarUrl?: string;
      bannerUrl?: string;
    }) =>
      request<{ identity: Identity }>("/api/identities", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    
    update: (identityId: string, data: Partial<{
      displayName: string;
      handle: string;
      email: string | null;
      birthday: string | null;
      avatarUrl: string | null;
      bannerUrl: string | null;
    }>) =>
      request<{ identity: Identity }>(`/api/identities/${identityId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    
    setPrimary: (identityId: string) =>
      request<{ success: boolean }>(`/api/identities/${identityId}/set-primary`, {
        method: "POST",
      }),
    
    delete: (identityId: string) =>
      request<{ success: boolean }>(`/api/identities/${identityId}`, {
        method: "DELETE",
      }),
  },
  
  security: {
    get: () =>
      request<{
        passkeys: Passkey[];
        trustCodesRemaining: number;
        securityQuestionIds: number[];
      }>("/api/security"),
    
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
      request<{ codes: string[] }>("/api/security/trust-codes/regenerate", {
        method: "POST",
      }),
    
    updateSecurityQuestions: (
      questions: { questionId: number; answer: string }[]
    ) =>
      request<{ success: boolean }>("/api/security/questions", {
        method: "PUT",
        body: JSON.stringify({ questions }),
      }),
  },
  
  activity: {
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
  },
  
  mydata: {
    export: async () => {
      const token = localStorage.getItem("ave_session_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE}/api/mydata/export`, { headers });
      
      if (!response.ok) {
        const data = await response.json();
        throw new ApiError(response.status, data.error || "Export failed");
      }
      
      // Return as blob for download
      return response.blob();
    },
    
    delete: () =>
      request<{ success: boolean; message: string }>("/api/mydata", {
        method: "DELETE",
      }),
  },
  
  oauth: {
    getApp: (clientId: string) =>
      request<{
        app: {
          name: string;
          description?: string;
          iconUrl?: string;
          websiteUrl?: string;
          supportsE2ee: boolean;
        };
      }>(`/api/oauth/app/${encodeURIComponent(clientId)}`),
    
    authorize: (data: {
      clientId: string;
      redirectUri: string;
      scope: string;
      state?: string;
      identityId: string;
      codeChallenge?: string;
      codeChallengeMethod?: "S256" | "plain";
      encryptedAppKey?: string;
      nonce?: string;
    }) =>
      request<{ redirectUrl: string }>("/api/oauth/authorize", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    
    getAuthorization: (clientId: string) =>
      request<{
        authorization: {
          id: string;
          identityId: string;
          encryptedAppKey?: string;
          createdAt: string;
        } | null;
      }>(`/api/oauth/authorization/${encodeURIComponent(clientId)}`),
    
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
  },
  
  signing: {
    // Get signing keys for all user's identities
    getKeys: () =>
      request<{
        keys: {
          identityId: string;
          handle: string;
          displayName: string;
          hasSigningKey: boolean;
          publicKey: string | null;
          createdAt: string | null;
        }[];
      }>("/api/signing/keys"),
    
    // Get signing key for a specific identity
    getKey: (identityId: string) =>
      request<{
        hasKey: boolean;
        publicKey: string | null;
        encryptedPrivateKey: string | null;
        createdAt?: string;
      }>(`/api/signing/keys/${identityId}`),
    
    // Store a new signing key
    createKey: (identityId: string, publicKey: string, encryptedPrivateKey: string) =>
      request<{
        success: boolean;
        publicKey: string;
        createdAt: string;
      }>(`/api/signing/keys/${identityId}`, {
        method: "POST",
        body: JSON.stringify({ publicKey, encryptedPrivateKey }),
      }),
    
    // Rotate signing key
    rotateKey: (identityId: string, publicKey: string, encryptedPrivateKey: string) =>
      request<{
        success: boolean;
        publicKey: string;
        createdAt: string;
      }>(`/api/signing/keys/${identityId}`, {
        method: "PUT",
        body: JSON.stringify({ publicKey, encryptedPrivateKey }),
      }),
    
    // Get pending signature requests
    getRequests: () =>
      request<{
        requests: SignatureRequest[];
      }>("/api/signing/requests"),
    
    // Get a specific signature request
    getRequest: (requestId: string) =>
      request<{
        request: {
          id: string;
          payload: string;
          metadata?: Record<string, unknown>;
          status: string;
          createdAt: string;
          expiresAt: string;
          signature?: string;
          resolvedAt?: string;
        };
        app: {
          id: string;
          name: string;
          iconUrl?: string;
          websiteUrl?: string;
        };
        identity: {
          id: string;
          handle: string;
          displayName: string;
          avatarUrl?: string | null;
        };
        signingKey: {
          publicKey: string;
          encryptedPrivateKey: string;
        } | null;
      }>(`/api/signing/requests/${requestId}`),
    
    // Submit a signature
    sign: (requestId: string, signature: string) =>
      request<{ success: boolean; signature: string }>(`/api/signing/requests/${requestId}/sign`, {
        method: "POST",
        body: JSON.stringify({ signature }),
      }),
    
    // Deny a signature request
    deny: (requestId: string) =>
      request<{ success: boolean }>(`/api/signing/requests/${requestId}/deny`, {
        method: "POST",
      }),
    
    // Get public key by handle (public endpoint)
    getPublicKey: (handle: string) =>
      request<{
        handle: string;
        publicKey: string;
        createdAt: string;
      }>(`/api/signing/public-key/${encodeURIComponent(handle)}`),
    
    // Verify a signature (public endpoint)
    verify: (message: string, signature: string, publicKey: string) =>
      request<{ valid: boolean; error?: string }>("/api/signing/verify", {
        method: "POST",
        body: JSON.stringify({ message, signature, publicKey }),
      }),
  },
  
  upload: {
    avatar: async (identityId: string, file: File) => {
      const token = localStorage.getItem("ave_session_token");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("identityId", identityId);
      
      const response = await fetch(`${API_BASE}/api/upload/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new ApiError(response.status, data.error || "Upload failed");
      }
      
      return response.json() as Promise<{ avatarUrl: string }>;
    },
    
    banner: async (identityId: string, file: File) => {
      const token = localStorage.getItem("ave_session_token");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("identityId", identityId);
      
      const response = await fetch(`${API_BASE}/api/upload/banner`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new ApiError(response.status, data.error || "Upload failed");
      }
      
      return response.json() as Promise<{ bannerUrl: string }>;
    },
    
    deleteAvatar: (identityId: string) =>
      request<{ success: boolean }>(`/api/upload/avatar/${identityId}`, {
        method: "DELETE",
      }),
    
    deleteBanner: (identityId: string) =>
      request<{ success: boolean }>(`/api/upload/banner/${identityId}`, {
        method: "DELETE",
      }),
  },
};

export { ApiError };
