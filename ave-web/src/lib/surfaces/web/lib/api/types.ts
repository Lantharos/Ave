// Auth types
export interface Identity {
  id: string;
  displayName: string;
  handle: string;
  email?: string;
  pendingEmail?: string | null;
  birthday?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  isPrimary: boolean;
  createdAt?: string;
  hasEncryptionKey?: boolean;
}

export interface OAuthAuthorization {
  id: string;
  identityId: string;
  encryptedAppKey?: string;
  appPublicKey?: string;
  encryptedAppPrivateKey?: string;
  appEncryptionMode?: string;
  createdAt: string;
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
  isNew?: boolean;
}

export interface SessionBootstrap {
  identities: Identity[];
  readOnly?: boolean;
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

export interface IdentityEncryptionKey {
  publicKey: string;
  encryptedPrivateKey: string;
}
