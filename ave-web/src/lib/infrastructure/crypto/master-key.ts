import { decrypt, deriveSharedKey, encrypt, exportMasterKey, importMasterKey, importPublicKey } from "./core";

async function deriveKeyFromTrustCode(code: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(code.toUpperCase().replace(/[^A-Z0-9]/g, "")), "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode("ave-trust-code-salt-v1"), iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

export async function createMasterKeyBackup(masterKey: CryptoKey, trustCodes: string[]): Promise<string> {
  const masterKeyData = await exportMasterKey(masterKey);
  const backups: string[] = [];
  for (const code of trustCodes) backups.push(await encrypt(masterKeyData, await deriveKeyFromTrustCode(code)));
  return JSON.stringify({ version: 1, backups });
}

export async function recoverMasterKeyFromBackup(backup: string, trustCode: string): Promise<CryptoKey | null> {
  try {
    const data = JSON.parse(backup) as { backups?: unknown };
    if (!Array.isArray(data.backups) || !data.backups.every((entry) => typeof entry === "string")) return null;
    const derivedKey = await deriveKeyFromTrustCode(trustCode);
    for (const encryptedBackup of data.backups) {
      try { return await importMasterKey(await decrypt(encryptedBackup, derivedKey)); } catch { }
    }
  } catch { }
  return null;
}

export async function encryptMasterKeyForDevice(masterKey: CryptoKey, recipientPublicKeyB64: string, senderPrivateKey: CryptoKey): Promise<string> {
  const sharedKey = await deriveSharedKey(senderPrivateKey, await importPublicKey(recipientPublicKeyB64));
  return encrypt(await exportMasterKey(masterKey), sharedKey);
}

export async function decryptMasterKeyFromDevice(encryptedMasterKey: string, senderPublicKeyB64: string, recipientPrivateKey: CryptoKey): Promise<CryptoKey> {
  const sharedKey = await deriveSharedKey(recipientPrivateKey, await importPublicKey(senderPublicKeyB64));
  return importMasterKey(await decrypt(encryptedMasterKey, sharedKey));
}

export async function masterKeysMatch(left: CryptoKey, right: CryptoKey): Promise<boolean> {
  try {
    const [leftData, rightData] = await Promise.all([exportMasterKey(left), exportMasterKey(right)]);
    const leftBytes = new Uint8Array(leftData);
    const rightBytes = new Uint8Array(rightData);
    if (leftBytes.length !== rightBytes.length) return false;
    return leftBytes.every((byte, index) => byte === rightBytes[index]);
  } catch { return false; }
}

function deriveKeyFromPrf(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", prfOutput, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptMasterKeyWithPrf(masterKey: CryptoKey, prfOutput: ArrayBuffer): Promise<string> {
  return encrypt(await exportMasterKey(masterKey), await deriveKeyFromPrf(prfOutput));
}

export async function decryptMasterKeyWithPrf(encryptedMasterKey: string, prfOutput: ArrayBuffer): Promise<CryptoKey> {
  return importMasterKey(await decrypt(encryptedMasterKey, await deriveKeyFromPrf(prfOutput)));
}
