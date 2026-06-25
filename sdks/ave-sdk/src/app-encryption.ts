import { getApiBase } from "./api-base.js";

export const E2EE_SCOPES = {
  SYMMETRIC: "e2ee:symmetric",
  ASYMMETRIC: "e2ee:asymmetric",
  PQC_KYBER: "e2ee:pqc:kyber",
  PQC_DILITHIUM: "e2ee:pqc:dilithium",
} as const;

export const E2EE_RESET_SCOPE = "e2ee:reset" as const;

export type E2eeScope = (typeof E2EE_SCOPES)[keyof typeof E2EE_SCOPES];

export class AppEncryptionLookupError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AppEncryptionLookupError";
    this.status = status;
  }
}

async function readLookupError(response: Response): Promise<never> {
  const data = await response.json().catch(() => ({}));
  const message =
    typeof (data as { error?: string }).error === "string"
      ? (data as { error: string }).error
      : "App encryption lookup failed";
  throw new AppEncryptionLookupError(response.status, message);
}

export interface AppEncryptionUserRecord {
  clientId: string;
  identityId: string;
  handle: string;
  displayName: string;
  publicKey: string;
  encryptionMode: string;
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toPlainArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

async function importAppPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    toPlainArrayBuffer(decodeBase64(publicKeyB64)),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
}

async function importAppPrivateKeyMaterial(privateKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    toPlainArrayBuffer(decodeBase64(privateKeyB64)),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"],
  );
}

async function deriveSharedKey(privateKey: CryptoKey, peerPublicKeyB64: string): Promise<CryptoKey> {
  const publicKey = await importAppPublicKey(peerPublicKeyB64);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function lookupAppPublicKeyByHandle(
  config: { issuer?: string; clientId: string },
  handle: string,
): Promise<AppEncryptionUserRecord> {
  const apiBase = getApiBase(config.issuer);
  const search = new URLSearchParams({
    client_id: config.clientId,
    handle,
  });
  const response = await fetch(`${apiBase}/api/encryption/app-lookup?${search.toString()}`);
  if (!response.ok) {
    return readLookupError(response);
  }
  return response.json() as Promise<AppEncryptionUserRecord>;
}

export async function lookupAppUserByPublicKey(
  config: { issuer?: string; clientId: string },
  publicKey: string,
): Promise<AppEncryptionUserRecord> {
  const apiBase = getApiBase(config.issuer);
  const search = new URLSearchParams({
    client_id: config.clientId,
    public_key: publicKey,
  });
  const response = await fetch(`${apiBase}/api/encryption/app-lookup?${search.toString()}`);
  if (!response.ok) {
    return readLookupError(response);
  }
  return response.json() as Promise<AppEncryptionUserRecord>;
}

export interface AppEncryptedPayload {
  encryptedPayload: string;
  senderPublicKey: string;
}

export async function encryptForAppUser(
  payload: string | Uint8Array | ArrayBuffer,
  recipientPublicKey: string,
): Promise<AppEncryptedPayload> {
  const sender = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"],
  );
  const senderPublicKeyData = await crypto.subtle.exportKey("spki", sender.publicKey);
  const senderPublicKey = encodeBase64(new Uint8Array(senderPublicKeyData));
  const sharedKey = await deriveSharedKey(sender.privateKey, recipientPublicKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintextBuffer =
    typeof payload === "string"
      ? toPlainArrayBuffer(new TextEncoder().encode(payload))
      : payload instanceof Uint8Array
        ? toPlainArrayBuffer(payload)
        : payload;
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    plaintextBuffer,
  );
  const packed = new Uint8Array(iv.byteLength + encrypted.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(encrypted), iv.byteLength);
  return {
    encryptedPayload: encodeBase64(packed),
    senderPublicKey,
  };
}

export async function encryptForAppHandle(
  payload: string | Uint8Array | ArrayBuffer,
  params: { issuer?: string; clientId: string; handle: string },
): Promise<AppEncryptedPayload> {
  const recipient = await lookupAppPublicKeyByHandle(params, params.handle);
  return encryptForAppUser(payload, recipient.publicKey);
}

export async function decryptFromAppSender(
  wrapped: AppEncryptedPayload,
  recipientPrivateKeyB64: string,
): Promise<ArrayBuffer> {
  const privateKey = await importAppPrivateKeyMaterial(recipientPrivateKeyB64);
  const sharedKey = await deriveSharedKey(privateKey, wrapped.senderPublicKey);
  const packed = decodeBase64(wrapped.encryptedPayload);
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, ciphertext);
}

export async function importAppPrivateKey(privateKeyB64: string): Promise<CryptoKey> {
  return importAppPrivateKeyMaterial(privateKeyB64);
}
