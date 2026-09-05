const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGORITHM, length: KEY_LENGTH }, true, ["encrypt", "decrypt"]);
}

export function exportMasterKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey("raw", key);
}

export function importMasterKey(keyData: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyData, { name: ALGORITHM, length: KEY_LENGTH }, true, ["encrypt", "decrypt"]);
}

export async function encrypt(data: ArrayBuffer | string, key: CryptoKey): Promise<string> {
  const dataBuffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, dataBuffer);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return bytesToBase64(combined);
}

export function decrypt(encryptedData: string, key: CryptoKey): Promise<ArrayBuffer> {
  const combined = base64ToBytes(encryptedData);
  return crypto.subtle.decrypt({ name: ALGORITHM, iv: combined.slice(0, 12) }, key, combined.slice(12));
}

export async function decryptToString(encryptedData: string, key: CryptoKey): Promise<string> {
  return new TextDecoder().decode(await decrypt(encryptedData, key));
}

export async function generateEphemeralKeyPair(): Promise<{ publicKey: string; privateKey: CryptoKey }> {
  const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const publicKeyData = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  return { publicKey: bytesToBase64(new Uint8Array(publicKeyData)), privateKey: keyPair.privateKey };
}

export function importPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("spki", base64ToBytes(publicKeyB64), { name: "ECDH", namedCurve: "P-256" }, false, []);
}

export function deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey }, privateKey,
    { name: ALGORITHM, length: KEY_LENGTH }, false, ["encrypt", "decrypt"],
  );
}

export function generateIdentityEncryptionKeyPair(): Promise<{ publicKey: string; privateKey: CryptoKey }> {
  return generateEphemeralKeyPair();
}

export function exportIdentityEncryptionPrivateKey(privateKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey("pkcs8", privateKey);
}

export function importIdentityEncryptionPrivateKey(privateKeyData: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("pkcs8", privateKeyData, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
}
