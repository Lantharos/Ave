export function decodeWrappedPayloadParam(value: string): { encryptedPayload: string; senderPublicKey: string } {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  const parsed = JSON.parse(json) as Partial<{ encryptedPayload: string; senderPublicKey: string }>;
  if (!parsed.encryptedPayload || !parsed.senderPublicKey) throw new Error("Invalid wrapped payload");
  return { encryptedPayload: parsed.encryptedPayload, senderPublicKey: parsed.senderPublicKey };
}

export function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const CITADEL_RECIPIENT_WRAP_INFO = new TextEncoder().encode("citadel-recipient-wrap-v1");

export async function deriveCitadelRecipientStorageKeyFromAppKey(appKeyRaw: ArrayBuffer, resourceKey: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", appKeyRaw, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode(`citadel:ss:${resourceKey}`),
      info: CITADEL_RECIPIENT_WRAP_INFO,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function parseAppKeyBase64ToBytes(appKeyB64: string): ArrayBuffer | null {
  try {
    const binary = atob(appKeyB64.replace(/ /g, "+"));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  } catch { return null; }
}
