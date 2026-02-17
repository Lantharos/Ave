import { Buffer } from "buffer";
import { gcm } from "@noble/ciphers/aes.js";
import { concatBytes, randomBytes, utf8ToBytes } from "@noble/ciphers/utils.js";
import { p256 } from "@noble/curves/nist.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const TRUST_CODE_SALT = "ave-trust-code-salt-v1";
const P256_SPKI_PREFIX = Buffer.from(
  "3059301306072A8648CE3D020106082A8648CE3D030107034200",
  "hex"
);

type BackupData = {
  version: number;
  backups: string[];
};

function toB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromB64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

function normalizeTrustCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function deriveTrustKey(code: string): Uint8Array {
  return pbkdf2(sha256, utf8ToBytes(normalizeTrustCode(code)), utf8ToBytes(TRUST_CODE_SALT), {
    c: 100000,
    dkLen: 32,
  });
}

function decryptAesGcmB64(payloadB64: string, key: Uint8Array): Uint8Array {
  const combined = fromB64(payloadB64);
  if (combined.length < 12 + 16) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  return gcm(key, iv).decrypt(ciphertext);
}

function encryptAesGcmB64(plaintext: Uint8Array, key: Uint8Array): string {
  const iv = randomBytes(12);
  const ciphertext = gcm(key, iv).encrypt(plaintext);
  return toB64(concatBytes(iv, ciphertext));
}

function parseP256SpkiPublicKey(spkiB64: string): Uint8Array {
  const spki = fromB64(spkiB64);

  if (spki.length >= P256_SPKI_PREFIX.length + 65) {
    const maybePrefix = spki.slice(0, P256_SPKI_PREFIX.length);
    const prefixMatches = Buffer.from(maybePrefix).equals(P256_SPKI_PREFIX);
    if (prefixMatches) {
      const raw = spki.slice(P256_SPKI_PREFIX.length);
      if (raw.length === 65 && raw[0] === 0x04) {
        return raw;
      }
    }
  }

  for (let index = spki.length - 65; index >= 0; index--) {
    if (spki[index] === 0x04 && index + 65 <= spki.length) {
      return spki.slice(index, index + 65);
    }
  }

  throw new Error("Unsupported requester public key format");
}

function toP256SpkiB64(rawPublicKey: Uint8Array): string {
  if (rawPublicKey.length !== 65 || rawPublicKey[0] !== 0x04) {
    throw new Error("Invalid P-256 public key");
  }

  const spki = concatBytes(new Uint8Array(P256_SPKI_PREFIX), rawPublicKey);
  return toB64(spki);
}

function deriveEcdhAesKey(secretKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array {
  const shared = p256.getSharedSecret(secretKey, peerPublicKey, true);
  if (shared.length < 33) {
    throw new Error("Invalid ECDH shared secret");
  }
  return shared.slice(1, 33);
}

export function recoverMasterKeyFromBackup(backupJson: string, trustCode: string): Uint8Array | null {
  let parsed: BackupData;
  try {
    parsed = JSON.parse(backupJson) as BackupData;
  } catch {
    return null;
  }

  if (!Array.isArray(parsed.backups) || parsed.backups.length === 0) {
    return null;
  }

  const key = deriveTrustKey(trustCode);

  for (const encryptedBackup of parsed.backups) {
    try {
      return decryptAesGcmB64(encryptedBackup, key);
    } catch {
      continue;
    }
  }

  return null;
}

export function encryptMasterKeyForRequester(
  masterKeyRaw: Uint8Array,
  requesterPublicKeySpkiB64: string
): { encryptedMasterKey: string; approverPublicKey: string } {
  const requesterRawPub = parseP256SpkiPublicKey(requesterPublicKeySpkiB64);
  const approverSecret = p256.utils.randomSecretKey();
  const approverPublicRaw = p256.getPublicKey(approverSecret, false);

  const sharedAesKey = deriveEcdhAesKey(approverSecret, requesterRawPub);
  const encryptedMasterKey = encryptAesGcmB64(masterKeyRaw, sharedAesKey);
  const approverPublicKey = toP256SpkiB64(approverPublicRaw);

  return { encryptedMasterKey, approverPublicKey };
}

export function createRequesterKeyPair(): {
  requesterPrivateKey: Uint8Array;
  requesterPublicKey: string;
} {
  const requesterPrivateKey = p256.utils.randomSecretKey();
  const requesterPublicRaw = p256.getPublicKey(requesterPrivateKey, false);
  return {
    requesterPrivateKey,
    requesterPublicKey: toP256SpkiB64(requesterPublicRaw),
  };
}

export function decryptMasterKeyFromApprover(
  encryptedMasterKey: string,
  approverPublicKeySpkiB64: string,
  requesterPrivateKey: Uint8Array
): Uint8Array {
  const approverPublicRaw = parseP256SpkiPublicKey(approverPublicKeySpkiB64);
  const sharedAesKey = deriveEcdhAesKey(requesterPrivateKey, approverPublicRaw);
  return decryptAesGcmB64(encryptedMasterKey, sharedAesKey);
}

export function masterKeyToB64(masterKeyRaw: Uint8Array): string {
  return toB64(masterKeyRaw);
}

export function masterKeyFromB64(value: string): Uint8Array {
  return fromB64(value);
}
