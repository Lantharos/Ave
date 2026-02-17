export type Scope = "openid" | "profile" | "email" | "offline_access" | "user_id";

export interface TokenResponse {
  access_token: string;
  access_token_jwt: string;
  id_token?: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  user?: {
    id: string;
    handle: string;
    displayName: string;
    email?: string;
    avatarUrl?: string;
  };
  encrypted_app_key?: string;
  user_id?: string;
}

export interface UserInfo {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  picture?: string;
  iss?: string;
  user_id?: string;
}

// Ave Signing types
export interface SignatureRequest {
  requestId: string;
  expiresAt: string;
  publicKey: string;
}

export interface SignatureResult {
  status: "signed" | "denied" | "expired" | "pending";
  signature?: string;
  resolvedAt?: string;
}

export interface SigningConfig {
  clientId: string;
  clientSecret: string;
  issuer?: string;
}

export interface DelegationTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
  audience: string;
  target_resource: string;
  communication_mode: "user_present" | "background";
}

export interface DelegationGrant {
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
}
