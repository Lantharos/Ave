import type { OrganizationSsoConnection } from "../db";
import { getApiBaseUrl } from "./sso-metadata";

type OidcDiscovery = {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  jwks_uri?: string;
};

type JsonWebKeySet = {
  keys?: JsonWebKey[];
};

export type OidcConfig = {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  clientId: string;
};

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeJsonSegment<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(segment))) as T;
}

export function randomBase64Url(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64UrlEncode(value);
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export function oidcCallbackUrl(connectionId: string): string {
  return `${getApiBaseUrl()}/api/business/sso/oidc/${connectionId}/callback`;
}

export async function resolveOidcConfig(connection: OrganizationSsoConnection): Promise<OidcConfig> {
  let issuer = connection.issuer || "";
  let authorizationEndpoint = connection.authorizationEndpoint || "";
  let tokenEndpoint = connection.tokenEndpoint || "";
  let jwksUri = connection.jwksUri || "";

  if (issuer && (!authorizationEndpoint || !tokenEndpoint || !jwksUri)) {
    const discoveryUrl = `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
    const response = await fetch(discoveryUrl, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("OIDC discovery failed");
    const discovery = await response.json() as OidcDiscovery;
    issuer = issuer || discovery.issuer || "";
    authorizationEndpoint = authorizationEndpoint || discovery.authorization_endpoint || "";
    tokenEndpoint = tokenEndpoint || discovery.token_endpoint || "";
    jwksUri = jwksUri || discovery.jwks_uri || "";
  }

  if (!issuer || !authorizationEndpoint || !tokenEndpoint || !jwksUri || !connection.clientId) {
    throw new Error("OIDC connection is incomplete");
  }

  return { issuer, authorizationEndpoint, tokenEndpoint, jwksUri, clientId: connection.clientId };
}

function importAlgorithm(jwk: JsonWebKey, alg: string): { keyAlgorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams; verifyAlgorithm: AlgorithmIdentifier | EcdsaParams | RsaPssParams } {
  if (alg === "RS256") {
    return {
      keyAlgorithm: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      verifyAlgorithm: { name: "RSASSA-PKCS1-v1_5" },
    };
  }
  if (alg === "ES256") {
    return {
      keyAlgorithm: { name: "ECDSA", namedCurve: "P-256" },
      verifyAlgorithm: { name: "ECDSA", hash: "SHA-256" },
    };
  }
  throw new Error(`Unsupported OIDC signing algorithm ${alg || jwk.alg || "unknown"}`);
}

export async function verifyOidcIdToken(input: {
  idToken: string;
  config: OidcConfig;
  nonce: string;
}): Promise<Record<string, unknown>> {
  const [headerSegment, payloadSegment, signatureSegment] = input.idToken.split(".");
  if (!headerSegment || !payloadSegment || !signatureSegment) throw new Error("Malformed ID token");

  const header = decodeJsonSegment<{ alg?: string; kid?: string; typ?: string }>(headerSegment);
  const payload = decodeJsonSegment<Record<string, unknown>>(payloadSegment);
  const alg = header.alg || "";
  if (alg === "none") throw new Error("Unsigned ID token rejected");

  const jwksResponse = await fetch(input.config.jwksUri, { headers: { accept: "application/json" } });
  if (!jwksResponse.ok) throw new Error("JWKS fetch failed");
  const jwks = await jwksResponse.json() as JsonWebKeySet;
  const jwk = jwks.keys?.find((key) => (key as JsonWebKey & { kid?: string }).kid === header.kid)
    || jwks.keys?.find((key) => (key as JsonWebKey & { alg?: string }).alg === alg);
  if (!jwk) throw new Error("OIDC signing key not found");

  const algorithms = importAlgorithm(jwk, alg);
  const key = await crypto.subtle.importKey("jwk", jwk, algorithms.keyAlgorithm, false, ["verify"]);
  const valid = await crypto.subtle.verify(
    algorithms.verifyAlgorithm,
    key,
    arrayBuffer(base64UrlDecode(signatureSegment)),
    new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
  );
  if (!valid) throw new Error("Invalid ID token signature");

  const now = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  const nbf = typeof payload.nbf === "number" ? payload.nbf : null;
  const aud = Array.isArray(payload.aud) ? payload.aud.map(String) : [String(payload.aud || "")];

  if (payload.iss !== input.config.issuer) throw new Error("ID token issuer mismatch");
  if (!aud.includes(input.config.clientId)) throw new Error("ID token audience mismatch");
  if (aud.length > 1 && payload.azp && payload.azp !== input.config.clientId) throw new Error("ID token authorized party mismatch");
  if (!exp || now >= exp) throw new Error("ID token expired");
  if (nbf && now < nbf) throw new Error("ID token not valid yet");
  if (payload.nonce !== input.nonce) throw new Error("ID token nonce mismatch");

  return payload;
}

export function encryptSsoClientSecret(secret: string): Promise<string> {
  return encryptSecret(secret);
}

export function decryptSsoClientSecret(encrypted: string | null): Promise<string | null> {
  if (!encrypted) return Promise.resolve(null);
  return decryptSecret(encrypted);
}

async function secretKey(): Promise<CryptoKey> {
  const configured = process.env.BUSINESS_SSO_SECRET_KEY || process.env.SESSION_SECRET;
  if (!configured) throw new Error("BUSINESS_SSO_SECRET_KEY is not configured");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(configured));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encryptSecret(secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await secretKey(), new TextEncoder().encode(secret));
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}

async function decryptSecret(encrypted: string): Promise<string> {
  if (!encrypted.startsWith("v1.")) return encrypted;
  const [, iv, ciphertext] = encrypted.split(".");
  if (!iv || !ciphertext) throw new Error("Malformed encrypted SSO secret");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: arrayBuffer(base64UrlDecode(iv)) },
    await secretKey(),
    arrayBuffer(base64UrlDecode(ciphertext)),
  );
  return new TextDecoder().decode(plaintext);
}
