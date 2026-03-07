import type { AveJwtClaims, JwkKey, JwksResponse, JwtHeader, JwtPayload, OidcConfiguration, VerifyJwtOptions } from "./types";

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

  const value = (async () => {
    const response = await fetcher(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url} (${response.status})`);
    }
    const ttlMs = parseCacheControlMaxAge(response.headers.get("cache-control")) ?? DEFAULT_CACHE_TTL_MS;
    const body = await response.json() as T;
    cache.set(url, {
      expiresAt: Date.now() + ttlMs,
      value: Promise.resolve(body),
    });
    return body;
  })().catch((error) => {
    cache.delete(url);
    throw error;
  });

  cache.set(url, {
    expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS,
    value,
  });

  return value;
}

function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
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

  const fetcher = options.fetcher ?? fetch;
  const discoveryUrl = options.discoveryUrl ?? getDiscoveryUrl(options.issuer);

  try {
    return await getCachedJson<OidcConfiguration>(discoveryCache, discoveryUrl, fetcher);
  } catch {
    if (!options.expectedIssuer && !options.jwksUrl) {
      return null;
    }
    return {
      issuer: options.expectedIssuer ?? getApiBase(options.issuer),
      jwks_uri: options.jwksUrl ?? getDefaultJwksUrl(options.issuer),
    };
  }
}

export async function fetchJwks(options: {
  issuer?: string;
  jwksUrl?: string;
  fetcher?: typeof fetch;
} = {}): Promise<JwksResponse> {
  const fetcher = options.fetcher ?? fetch;
  const jwksUrl = options.jwksUrl ?? getDefaultJwksUrl(options.issuer);
  return getCachedJson<JwksResponse>(jwksCache, jwksUrl, fetcher);
}

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

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
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
    const valid = await crypto.subtle.verify(
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
