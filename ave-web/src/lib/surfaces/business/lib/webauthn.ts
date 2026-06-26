import { startAuthentication, bufferToBase64URLString, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

const PRF_SALT = new TextEncoder().encode("ave-master-key-prf-v1");

function coalesceToBytes(input: unknown): Uint8Array | undefined {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (typeof input !== "string") return undefined;

  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function coalesceToBase64UrlString(input: unknown): string | null {
  if (typeof input === "string") return input;
  const bytes = coalesceToBytes(input);
  return bytes ? bufferToBase64URLString(toArrayBuffer(bytes)) : null;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function normalizeAuthenticationOptionsJSON(
  options: PublicKeyCredentialRequestOptions,
): PublicKeyCredentialRequestOptionsJSON {
  const challenge = coalesceToBase64UrlString(options.challenge);
  if (!challenge) throw new Error("Invalid WebAuthn challenge");

  return {
    ...options,
    challenge,
    allowCredentials: options.allowCredentials?.map((credential) => {
      const id = coalesceToBase64UrlString(credential.id);
      if (!id) throw new Error("Invalid WebAuthn credential id");
      return { ...credential, id };
    }),
  } as PublicKeyCredentialRequestOptionsJSON;
}

export async function authenticateWithPasskey(
  options: PublicKeyCredentialRequestOptions,
): Promise<{ credential: Credential; prfOutput?: ArrayBuffer }> {
  const normalizedOptions = normalizeAuthenticationOptionsJSON(options);
  const response = await startAuthentication({
    optionsJSON: {
      ...normalizedOptions,
      extensions: {
        ...((normalizedOptions as PublicKeyCredentialRequestOptionsJSON & { extensions?: Record<string, unknown> }).extensions || {}),
        prf: { eval: { first: toArrayBuffer(PRF_SALT) } },
      },
    } as Parameters<typeof startAuthentication>[0]["optionsJSON"],
  });

  const prfResult = (response as { clientExtensionResults?: { prf?: { results?: { first?: unknown } } } }).clientExtensionResults?.prf;
  const first = prfResult?.results?.first;
  const prfBytes = first ? coalesceToBytes(first) : null;
  return {
    credential: response as unknown as Credential,
    prfOutput: prfBytes ? toArrayBuffer(prfBytes) : undefined,
  };
}
