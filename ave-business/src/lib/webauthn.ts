import { startAuthentication } from "@simplewebauthn/browser";

const PRF_SALT = new TextEncoder().encode("ave-master-key-prf-v1");

function base64urlToBytes(input: string | ArrayBuffer | Uint8Array): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);

  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export async function authenticateWithPasskey(options: PublicKeyCredentialRequestOptions): Promise<{ credential: Credential; prfOutput?: ArrayBuffer }> {
  const response = await startAuthentication({
    optionsJSON: {
      ...options,
      extensions: {
        ...((options as any).extensions || {}),
        prf: { eval: { first: PRF_SALT } },
      },
    } as any,
  });

  const prfResult = (response as any).clientExtensionResults?.prf;
  const first = prfResult?.results?.first;
  const prfBytes = first ? base64urlToBytes(first) : null;
  return {
    credential: response as unknown as Credential,
    prfOutput: prfBytes
      ? prfBytes.buffer.slice(prfBytes.byteOffset, prfBytes.byteOffset + prfBytes.byteLength) as ArrayBuffer
      : undefined,
  };
}
