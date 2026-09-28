export type Scope =
  | "openid"
  | "profile"
  | "email"
  | "offline_access"
  | "user_id"
  | "e2ee:symmetric"
  | "e2ee:asymmetric"
  | "e2ee:reset"
  | "e2ee:pqc:kyber"
  | "e2ee:pqc:dilithium";

/** OAuth client config for PKCE and token calls */
export interface AveConfig {
  clientId: string;
  redirectUri: string;
  issuer?: string;
}

export interface JwtHeader {
  alg?: string;
  typ?: string;
  kid?: string;
}

export interface JwtPayload {
  jti?: string;
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
  /** Plaintext app encryption key after merging `#app_key` from the redirect fragment */
  app_key?: string;
  app_key_old?: string;
  app_public_key?: string;
  app_public_key_old?: string;
  app_private_key?: string;
  app_private_key_old?: string;
  /** True when the app requested `e2ee:reset` and keys were rotated */
  app_key_reset?: boolean;
  expires_in: number;
  scope: string;
  user?: {
    id: string;
    handle?: string;
    displayName?: string;
    email?: string;
    avatarUrl?: string | null;
  } | null;
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

export interface AppEncryptionUserRecord {
  clientId: string;
  identityId: string;
  handle: string;
  displayName: string;
  publicKey: string;
  encryptionMode: string;
}

export interface AppEncryptedPayload {
  encryptedPayload: string;
  senderPublicKey: string;
}
