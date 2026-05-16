import { createHash } from "crypto";
const encoder = new TextEncoder();

let privateKeyCache: { pem: string; key: CryptoKey } | null = null;
let publicKeyCache: { pem: string; key: CryptoKey; jwk: Record<string, string>; kid: string } | null = null;

function getJwtKid(): string {
  return process.env.OIDC_KID || "ave-oidc-v1";
}

function getJwtPrivateKeyPem(): string | undefined {
  return process.env.OIDC_PRIVATE_KEY_PEM;
}

function getJwtPublicKeyPem(): string | undefined {
  return process.env.OIDC_PUBLIC_KEY_PEM;
}

function base64UrlDecode(input: string): Uint8Array {
  return Uint8Array.from(Buffer.from(input, "base64url"));
}

function base64UrlEncode(input: Uint8Array): string {
  return Buffer.from(input).toString("base64url");
}

function pemBody(pem: string, label: "PRIVATE" | "PUBLIC"): ArrayBuffer {
  const bytes = Buffer.from(
    pem.replace(new RegExp(`-----\\w+ ${label} KEY-----`, "g"), "").replace(/\s+/g, ""),
    "base64",
  );
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function getPrivateKey(): Promise<CryptoKey> {
  const privateKeyPem = getJwtPrivateKeyPem();
  if (!privateKeyPem) {
    throw new Error("OIDC_PRIVATE_KEY_PEM is not configured");
  }

  if (privateKeyCache?.pem === privateKeyPem) {
    return privateKeyCache.key;
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBody(privateKeyPem, "PRIVATE"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  privateKeyCache = { pem: privateKeyPem, key };
  return key;
}

async function getPublicKeyAndJwk(): Promise<{ key: CryptoKey; jwk: Record<string, string> }> {
  const publicKeyPem = getJwtPublicKeyPem();
  if (!publicKeyPem) {
    throw new Error("OIDC_PUBLIC_KEY_PEM is not configured");
  }

  const kid = getJwtKid();
  if (publicKeyCache?.pem === publicKeyPem && publicKeyCache.kid === kid) {
    return publicKeyCache;
  }

  const key = await crypto.subtle.importKey(
    "spki",
    pemBody(publicKeyPem, "PUBLIC"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["verify"],
  );

  const exported = await crypto.subtle.exportKey("jwk", key);
  const jwk = {
    kty: exported.kty || "RSA",
    use: "sig",
    alg: "RS256",
    kid,
    n: exported.n || "",
    e: exported.e || "AQAB",
  };

  publicKeyCache = { pem: publicKeyPem, key, jwk, kid };
  return { key, jwk };
}

export function getIssuer(): string {
  return process.env.OIDC_ISSUER || "https://api.aveid.net";
}

export function getResourceAudience(): string {
  return process.env.OIDC_RESOURCE_AUDIENCE || "https://api.aveid.net";
}

export async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: getJwtKid(),
  };

  const headerSegment = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadSegment = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const data = `${headerSegment}.${payloadSegment}`;
  const key = await getPrivateKey();

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(data)
  );

  return `${data}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function getJwtPublicJwk(): Promise<Record<string, string>> {
  return (await getPublicKeyAndJwk()).jwk;
}

async function readVerifiedJwtPayloadWithoutAudience(token: string): Promise<Record<string, unknown> | null> {
  if (!getJwtPublicKeyPem()) {
    return null;
  }

  const [headerSegment, payloadSegment, signatureSegment] = token.split(".");
  if (!headerSegment || !payloadSegment || !signatureSegment) {
    return null;
  }

  const header = JSON.parse(Buffer.from(headerSegment, "base64url").toString("utf8"));
  if (header.alg !== "RS256") {
    return null;
  }

  const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
  const data = `${headerSegment}.${payloadSegment}`;
  const { key } = await getPublicKeyAndJwk();

  const signature = base64UrlDecode(signatureSegment);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    new Uint8Array(signature),
    encoder.encode(data)
  );

  if (!valid) {
    return null;
  }

  if (payload.iss !== getIssuer()) {
    return null;
  }

  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    return null;
  }

  return payload as Record<string, unknown>;
}

export async function verifyJwtSignatureIssuerExp(token: string): Promise<Record<string, unknown> | null> {
  return readVerifiedJwtPayloadWithoutAudience(token);
}

export async function verifyJwt(token: string, audience?: string): Promise<Record<string, unknown> | null> {
  const payload = await readVerifiedJwtPayloadWithoutAudience(token);
  if (!payload) {
    return null;
  }

  if (audience) {
    const aud = payload.aud;
    if (Array.isArray(aud)) {
      if (!aud.includes(audience)) return null;
    } else if (aud !== audience) {
      return null;
    }
  }

  return payload;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
