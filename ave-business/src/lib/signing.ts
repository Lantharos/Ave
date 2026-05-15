import * as ed from "@noble/ed25519";
import { decrypt, encrypt, loadMasterKey } from "./crypto-vault";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export async function generateSigningKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const privateKey = ed.utils.randomSecretKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return {
    publicKey: bytesToBase64(publicKey),
    privateKey: bytesToBase64(privateKey),
  };
}

export async function createSigningKeyForIdentity(masterKey: CryptoKey): Promise<{ publicKey: string; encryptedPrivateKey: string }> {
  const keyPair = await generateSigningKeyPair();
  return {
    publicKey: keyPair.publicKey,
    encryptedPrivateKey: await encrypt(keyPair.privateKey, masterKey),
  };
}

export async function signMessage(message: string, privateKeyB64: string): Promise<string> {
  const signature = await ed.signAsync(new TextEncoder().encode(message), base64ToBytes(privateKeyB64));
  return bytesToBase64(signature);
}

export async function signWithIdentityKey(message: string, encryptedPrivateKey: string): Promise<string | null> {
  const masterKey = await loadMasterKey();
  if (!masterKey) return null;
  const privateKey = new TextDecoder().decode(await decrypt(encryptedPrivateKey, masterKey));
  return signMessage(message, privateKey);
}
