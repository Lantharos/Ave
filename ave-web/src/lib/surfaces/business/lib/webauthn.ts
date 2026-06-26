import { startAuthentication, bufferToBase64URLString, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

const PRF_SALT = new TextEncoder().encode("ave-master-key-prf-v1");

function coalesceToBytes(input: unknown): Uint8Array | undefined {
  if (input == null) return undefined;
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (Array.isArray(input)) {
    if (input.every((value) => typeof value === "number")) {
      return new Uint8Array(input);
    }
    return undefined;
  }
  if (typeof input === "object") {
    const record = input as Record<string, unknown>;
    if (record.type === "Buffer" && Array.isArray(record.data)) {
      return new Uint8Array(record.data as number[]);
    }
    const numericValues = Object.keys(record)
      .filter((key) => /^\d+$/.test(key))
      .sort((left, right) => Number(left) - Number(right))
      .map((key) => record[key]);
    if (numericValues.length > 0 && numericValues.every((value) => typeof value === "number")) {
      return new Uint8Array(numericValues as number[]);
    }
  }
  if (typeof input !== "string") return undefined;

  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  try {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  } catch {
    return undefined;
  }
}

function coalesceToBase64UrlString(input: unknown): string | null {
  if (typeof input === "string") return input;
  const bytes = coalesceToBytes(input);
  return bytes ? bufferToBase64URLString(toArrayBuffer(bytes)) : null;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function readPrfOutput(input: unknown): ArrayBuffer | undefined {
  const bytes = coalesceToBytes(input);
  return bytes ? toArrayBuffer(bytes) : undefined;
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
  return {
    credential: response as unknown as Credential,
    prfOutput: first !== undefined ? readPrfOutput(first) : undefined,
  };
}
