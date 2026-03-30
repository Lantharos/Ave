export type Scope = "openid" | "profile" | "email" | "offline_access" | "user_id";

export interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
}

export interface JwtPayload {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nbf?: number;
  nonce?: string;
  [key: string]: unknown;
}

export interface AveJwtClaims extends JwtPayload {
  scope?: string;
  cid?: string;
  sid?: string;
  uid?: string;
  quick?: boolean;
}

export interface AveIdTokenClaims extends JwtPayload {
  auth_time?: number;
  azp?: string;
  sid?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  picture?: string;
}

export interface JwkKey {
  kid?: string;
  kty: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
}

export interface JwksResponse {
  keys: JwkKey[];
}

export interface OidcConfiguration {
  issuer: string;
  jwks_uri: string;
}

export interface VerifyJwtOptions {
  issuer?: string;
  expectedIssuer?: string;
  audience?: string | string[];
  nonce?: string;
  jwksUrl?: string;
  jwks?: JwksResponse;
  discoveryUrl?: string;
  clockSkewSeconds?: number;
  fetcher?: typeof fetch;
}

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
  } | null;
  user_id?: string;
}

export interface FedCmTokenResponse extends TokenResponse {
  app_key?: string;
  encryptedAppKey?: string;
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

export interface IdentityEncryptionPublicKey {
  identityId: string;
  handle: string;
  publicKey: string;
  createdAt: string;
}

export type SharedSecretKind = "app_scoped" | "global";

export interface SharedSecretDescriptor {
  id: string;
  kind: SharedSecretKind;
  appId?: string | null;
  resourceKey?: string | null;
  label?: string | null;
  appName?: string | null;
}

export interface TransferContract {
  id: string;
  targetHandle: string;
  status: "pending" | "claimed" | "expired";
  expiresAt: string;
  descriptor: SharedSecretDescriptor;
  returnUrl?: string | null;
}

export interface RecipientSharedSecretEnvelope {
  id: string;
  sharedSecretId: string;
  identityId: string;
  encryptedSecret: string;
  claimedAt?: string | null;
  descriptor: SharedSecretDescriptor;
  owner: {
    identityId: string;
    handle: string;
    displayName: string;
  };
}

export interface SharedSecretRecord extends SharedSecretDescriptor {
  status: string;
  createdAt: string;
}

export interface SharedSecretTransferResolution {
  id: string;
  sharedSecretId: string;
  encryptedSecretForTarget: string;
  senderPublicKey: string;
  targetHandle: string;
  expiresAt: string;
  descriptor: SharedSecretDescriptor;
  returnUrl?: string | null;
  owner: {
    identityId: string;
    handle: string;
    displayName: string;
  };
}
