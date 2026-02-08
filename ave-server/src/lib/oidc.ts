import { createHash } from "crypto";

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

export function getIssuer(): string {
  return process.env.OIDC_ISSUER || "https://api.aveid.net";
}

export function getResourceAudience(): string {
  return process.env.OIDC_RESOURCE_AUDIENCE || "https://api.aveid.net";
}

export async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const privateKeyPem = getJwtPrivateKeyPem();
  if (!privateKeyPem) {
    throw new Error("OIDC_PRIVATE_KEY_PEM is not configured");
  }

  const encoder = new TextEncoder();
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: getJwtKid(),
  };

  const headerSegment = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadSegment = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const data = `${headerSegment}.${payloadSegment}`;

  const keyData = Buffer.from(
    privateKeyPem.replace(/-----\w+ PRIVATE KEY-----/g, "").replace(/\s+/g, ""),
    "base64"
  );

  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(data)
  );

  return `${data}.${Buffer.from(signature).toString("base64url")}`;
}

export async function getJwtPublicJwk(): Promise<Record<string, string>> {
  const publicKeyPem = getJwtPublicKeyPem();
  if (!publicKeyPem) {
    throw new Error("OIDC_PUBLIC_KEY_PEM is not configured");
  }

  const keyData = Buffer.from(
    publicKeyPem.replace(/-----\w+ PUBLIC KEY-----/g, "").replace(/\s+/g, ""),
    "base64"
  );

  const key = await crypto.subtle.importKey(
    "spki",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["verify"]
  );

  const jwk = await crypto.subtle.exportKey("jwk", key);

  return {
    kty: jwk.kty || "RSA",
    use: "sig",
    alg: "RS256",
    kid: getJwtKid(),
    n: jwk.n || "",
    e: jwk.e || "AQAB",
  };
}

export async function verifyJwt(token: string, audience?: string): Promise<Record<string, unknown> | null> {
  const publicKeyPem = getJwtPublicKeyPem();
  if (!publicKeyPem) {
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

  const keyData = Buffer.from(
    publicKeyPem.replace(/-----\w+ PUBLIC KEY-----/g, "").replace(/\s+/g, ""),
    "base64"
  );

  const key = await crypto.subtle.importKey(
    "spki",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signature = base64UrlDecode(signatureSegment);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    new TextEncoder().encode(data)
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

  if (audience) {
    const aud = payload.aud;
    if (Array.isArray(aud)) {
      if (!aud.includes(audience)) return null;
    } else if (aud !== audience) {
      return null;
    }
  }

  return payload as Record<string, unknown>;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
