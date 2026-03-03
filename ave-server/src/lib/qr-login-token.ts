import { createHmac, timingSafeEqual } from "crypto";

type QrLoginTokenPayload = {
  rid: string;
  iat: number;
  exp: number;
  purpose: "login_qr";
};

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function getSecret(): string {
  return process.env.SESSION_SECRET || "";
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createQrLoginToken(requestId: string, ttlSeconds = 300): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET is required for QR login tokens");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: QrLoginTokenPayload = {
    rid: requestId,
    iat: now,
    exp: now + ttlSeconds,
    purpose: "login_qr",
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(data, secret);

  return `${data}.${signature}`;
}

export function verifyQrLoginToken(token: string): { valid: boolean; requestId?: string } {
  const secret = getSecret();
  if (!secret) {
    return { valid: false };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return { valid: false };
  }

  const data = `${encodedHeader}.${encodedPayload}`;
  const expected = sign(data, secret);

  const expectedBytes = fromBase64Url(expected);
  const providedBytes = fromBase64Url(encodedSignature);

  if (expectedBytes.length !== providedBytes.length) {
    return { valid: false };
  }

  if (!timingSafeEqual(expectedBytes, providedBytes)) {
    return { valid: false };
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as QrLoginTokenPayload;
    const now = Math.floor(Date.now() / 1000);

    if (payload.purpose !== "login_qr") {
      return { valid: false };
    }

    if (typeof payload.exp !== "number" || payload.exp < now) {
      return { valid: false };
    }

    if (!payload.rid) {
      return { valid: false };
    }

    return { valid: true, requestId: payload.rid };
  } catch {
    return { valid: false };
  }
}
