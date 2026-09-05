import {
  bytesToBase64, decrypt, decryptToString, encrypt,
  exportIdentityEncryptionPrivateKey, generateIdentityEncryptionKeyPair,
  importIdentityEncryptionPrivateKey,
} from "$lib/infrastructure/crypto/core";

export function generateAppKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function exportAppKey(key: CryptoKey): Promise<string> {
  return bytesToBase64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

export function importAppKey(keyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw", Uint8Array.from(atob(keyB64), (character) => character.charCodeAt(0)),
    { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"],
  );
}

export async function encryptAppKey(appKey: CryptoKey, masterKey: CryptoKey): Promise<string> {
  return encrypt(await exportAppKey(appKey), masterKey);
}

export async function decryptAppKey(encryptedAppKey: string, masterKey: CryptoKey): Promise<CryptoKey> {
  return importAppKey(await decryptToString(encryptedAppKey, masterKey));
}

export function generateAppKeyPair(): Promise<{ publicKey: string; privateKey: CryptoKey }> {
  return generateIdentityEncryptionKeyPair();
}

export async function exportAppPrivateKeyB64(privateKey: CryptoKey): Promise<string> {
  return bytesToBase64(new Uint8Array(await exportIdentityEncryptionPrivateKey(privateKey)));
}

export async function encryptAppPrivateKey(privateKey: CryptoKey, masterKey: CryptoKey): Promise<string> {
  return encrypt(await exportIdentityEncryptionPrivateKey(privateKey), masterKey);
}

export function decryptAppPrivateKey(encryptedAppPrivateKey: string, masterKey: CryptoKey): Promise<CryptoKey> {
  return loadIdentityEncryptionPrivateKey(encryptedAppPrivateKey, masterKey);
}

export async function decryptAppPrivateKeyB64(encryptedAppPrivateKey: string, masterKey: CryptoKey): Promise<string> {
  return bytesToBase64(new Uint8Array(await decrypt(encryptedAppPrivateKey, masterKey)));
}

export async function createStoredIdentityEncryptionKeyPair(masterKey: CryptoKey): Promise<{ publicKey: string; encryptedPrivateKey: string }> {
  const keyPair = await generateIdentityEncryptionKeyPair();
  return {
    publicKey: keyPair.publicKey,
    encryptedPrivateKey: await encrypt(await exportIdentityEncryptionPrivateKey(keyPair.privateKey), masterKey),
  };
}

export async function loadIdentityEncryptionPrivateKey(encryptedPrivateKey: string, masterKey: CryptoKey): Promise<CryptoKey> {
  return importIdentityEncryptionPrivateKey(await decrypt(encryptedPrivateKey, masterKey));
}
