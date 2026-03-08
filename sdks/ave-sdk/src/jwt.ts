import type { AveJwtClaims, JwkKey, JwksResponse, JwtHeader, JwtPayload, OidcConfiguration, VerifyJwtOptions } from "./types.js";

const DEFAULT_ISSUER = "https://aveid.net";
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

const discoveryCache = new Map<string, { expiresAt: number; value: Promise<OidcConfiguration> }>();
const jwksCache = new Map<string, { expiresAt: number; value: Promise<JwksResponse> }>();

function getApiBase(issuer?: string): string {
  const base = issuer || DEFAULT_ISSUER;
  return base.replace("https://aveid.net", "https://api.aveid.net");
}

function getDiscoveryUrl(issuer?: string): string {
  return `${getApiBase(issuer)}/.well-known/openid-configuration`;
}

function getDefaultJwksUrl(issuer?: string): string {
  return `${getApiBase(issuer)}/.well-known/jwks.json`;
}

function getGlobalFetch(): typeof fetch | null {
  return (
    globalThis as typeof globalThis & {
      fetch?: typeof fetch;
    }
  ).fetch ?? null;
}

function getDefaultOidcConfiguration(options: {
  issuer?: string;
  expectedIssuer?: string;
  jwksUrl?: string;
}): OidcConfiguration {
  return {
    issuer: options.expectedIssuer ?? getApiBase(options.issuer),
    jwks_uri: options.jwksUrl ?? getDefaultJwksUrl(options.issuer),
  };
}

function parseCacheControlMaxAge(cacheControl: string | null): number | null {
  if (!cacheControl) return null;
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) return null;
  const seconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds * 1000;
}

function getCachedJson<T>(
  cache: Map<string, { expiresAt: number; value: Promise<T> }>,
  url: string,
  fetcher: typeof fetch,
): Promise<T> {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const entry: { expiresAt: number; value: Promise<T> } = {
    expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS,
    value: Promise.resolve(undefined as unknown as T),
  };

  const value = (async () => {
    const response = await fetcher(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url} (${response.status})`);
    }
    const ttlMs = parseCacheControlMaxAge(response.headers.get("cache-control")) ?? DEFAULT_CACHE_TTL_MS;
    const body = await response.json() as T;
    if (cache.get(url) === entry) {
      entry.expiresAt = Date.now() + ttlMs;
      entry.value = Promise.resolve(body);
    }
    return body;
  })().catch((error) => {
    if (cache.get(url) === entry) {
      cache.delete(url);
    }
    throw error;
  });

  entry.value = value;
  cache.set(url, entry);

  return value;
}

function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  if (typeof atob === "function") {
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  const bufferCtor = (
    globalThis as typeof globalThis & {
      Buffer?: {
        from(input: string, encoding: string): Uint8Array;
      };
    }
  ).Buffer;
  if (bufferCtor) {
    return new Uint8Array(bufferCtor.from(padded, "base64"));
  }

  throw new Error("No base64 decoder available in this environment");
}

function getSubtleCrypto(): SubtleCrypto | null {
  return globalThis.crypto?.subtle ?? null;
}

function parseJwtPart<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(value))) as T;
  } catch {
    return null;
  }
}

function matchesAudience(tokenAudience: string | string[] | undefined, expectedAudience: string | string[]): boolean {
  if (!tokenAudience) return false;
  const expected = Array.isArray(expectedAudience) ? expectedAudience : [expectedAudience];
  const actual = Array.isArray(tokenAudience) ? tokenAudience : [tokenAudience];
  return expected.some((audience) => actual.includes(audience));
}

function isUsableJwk(jwk: JwkKey | undefined): jwk is JwkKey & Required<Pick<JwkKey, "e" | "n">> {
  return !!jwk && jwk.kty === "RSA" && typeof jwk.e === "string" && typeof jwk.n === "string";
}

async function resolveOidcConfiguration(options: VerifyJwtOptions): Promise<OidcConfiguration | null> {
  if (options.expectedIssuer && options.jwksUrl) {
    return {
      issuer: options.expectedIssuer,
      jwks_uri: options.jwksUrl,
    };
  }

  const fetcher = options.fetcher ?? getGlobalFetch();
  const discoveryUrl = options.discoveryUrl ?? getDiscoveryUrl(options.issuer);

  if (!fetcher) {
    return getDefaultOidcConfiguration(options);
  }

  try {
    return await getCachedJson<OidcConfiguration>(discoveryCache, discoveryUrl, fetcher);
  } catch {
    return getDefaultOidcConfiguration(options);
  }
}

export async function fetchJwks(options: {
  issuer?: string;
  jwksUrl?: string;
  fetcher?: typeof fetch;
} = {}): Promise<JwksResponse> {
  const fetcher = options.fetcher ?? getGlobalFetch();
  if (!fetcher) {
    throw new Error("No fetch implementation available for JWKS retrieval. Please provide a fetcher option or ensure fetch is available in the global scope. This typically occurs in older Node.js runtimes or server environments without a fetch polyfill.");
  }
  const jwksUrl = options.jwksUrl ?? getDefaultJwksUrl(options.issuer);
  return getCachedJson<JwksResponse>(jwksCache, jwksUrl, fetcher);
}

/**
 * Verify an Ave JWT with OIDC discovery + JWKS.
 *
 * Issuer resolution order:
 * 1. `options.expectedIssuer`
 * 2. `options.issuer`
 * 3. the Ave default issuer (`https://aveid.net`)
 */
export async function verifyJwt<T extends JwtPayload = AveJwtClaims>(
  token: string,
  options: VerifyJwtOptions = {},
): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const header = parseJwtPart<JwtHeader>(headerSegment);
  const payload = parseJwtPart<T>(payloadSegment);

  if (!header || !payload || header.alg !== "RS256") {
    return null;
  }

  const config = await resolveOidcConfiguration(options);
  if (!config) {
    return null;
  }

  const expectedIssuer = options.expectedIssuer ?? config.issuer;
  if (payload.iss !== expectedIssuer) {
    return null;
  }

  const nowSeconds = Date.now() / 1000;
  const clockSkewSeconds = Math.max(0, options.clockSkewSeconds ?? 30);

  if (typeof payload.exp !== "number" || nowSeconds > payload.exp + clockSkewSeconds) {
    return null;
  }

  if (typeof payload.nbf === "number" && nowSeconds + clockSkewSeconds < payload.nbf) {
    return null;
  }

  if (options.audience && !matchesAudience(payload.aud, options.audience)) {
    return null;
  }

  if (options.nonce && payload.nonce !== options.nonce) {
    return null;
  }

  let jwks = options.jwks;
  if (!jwks) {
    try {
      jwks = await fetchJwks({
        issuer: options.issuer,
        jwksUrl: options.jwksUrl ?? config.jwks_uri,
        fetcher: options.fetcher,
      });
    } catch {
      return null;
    }
  }

  const jwk = header.kid
    ? jwks.keys.find((candidate) => candidate.kid === header.kid)
    : jwks.keys.find((candidate) => candidate.alg === "RS256" || candidate.kty === "RSA");

  if (!isUsableJwk(jwk)) {
    return null;
  }

  const subtle = getSubtleCrypto();
  if (!subtle) {
    return null;
  }

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await subtle.importKey(
      "jwk",
      jwk as JsonWebKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    return null;
  }

  try {
    const signature = new Uint8Array(base64UrlDecode(signatureSegment));
    const valid = await subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signature,
      new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
    );
    return valid ? payload : null;
  } catch {
    return null;
  }
}
