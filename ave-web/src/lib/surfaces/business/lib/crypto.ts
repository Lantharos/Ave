function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function importRecipientPublicKey(publicKeyB64: string) {
  return crypto.subtle.importKey(
    "spki",
    base64ToBytes(publicKeyB64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
}

async function deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey) {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
}

async function encryptSecret(secret: string, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(secret));
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bytesToBase64(combined);
}

export function generateOrgKeyMaterial() {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(key);
}

export async function wrapOrgKeyForIdentity(orgKey: string, recipientPublicKey: string) {
  const senderKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const publicKey = await importRecipientPublicKey(recipientPublicKey);
  const sharedKey = await deriveSharedKey(senderKeyPair.privateKey, publicKey);
  const senderPublicKeyRaw = await crypto.subtle.exportKey("spki", senderKeyPair.publicKey);
  return {
    encryptedKey: await encryptSecret(orgKey, sharedKey),
    senderPublicKey: bytesToBase64(new Uint8Array(senderPublicKeyRaw)),
    recipientPublicKey,
  };
}
