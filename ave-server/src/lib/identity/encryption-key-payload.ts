const MAX_OPAQUE_BLOB_BYTES = 65536;
const MIN_OPAQUE_BLOB_BYTES = 12;
const MAX_PUBLIC_KEY_BLOB_BYTES = 16384;
const MIN_PUBLIC_KEY_BLOB_BYTES = 20;

function decodeBase64Len(b64: string): number | null {
  try {
    return atob(b64).length;
  } catch {
    return null;
  }
}

export function validateOpaqueKeyEnvelope(b64: string): { ok: true } | { ok: false; error: string } {
  if (b64.length > Math.ceil((MAX_OPAQUE_BLOB_BYTES * 4) / 3) + 64) {
    return { ok: false, error: "encryptedPrivateKey exceeds maximum size" };
  }
  const len = decodeBase64Len(b64);
  if (len === null) {
    return { ok: false, error: "encryptedPrivateKey is not valid base64" };
  }
  if (len < MIN_OPAQUE_BLOB_BYTES || len > MAX_OPAQUE_BLOB_BYTES) {
    return { ok: false, error: "encryptedPrivateKey decoded size is out of range" };
  }
  return { ok: true };
}

export function validatePublicKeyBlob(b64: string): { ok: true } | { ok: false; error: string } {
  if (b64.length > Math.ceil((MAX_PUBLIC_KEY_BLOB_BYTES * 4) / 3) + 64) {
    return { ok: false, error: "publicKey exceeds maximum size" };
  }
  const len = decodeBase64Len(b64);
  if (len === null) {
    return { ok: false, error: "publicKey is not valid base64" };
  }
  if (len < MIN_PUBLIC_KEY_BLOB_BYTES || len > MAX_PUBLIC_KEY_BLOB_BYTES) {
    return { ok: false, error: "publicKey decoded size is out of range" };
  }
  return { ok: true };
}
