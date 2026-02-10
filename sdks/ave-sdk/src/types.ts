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
