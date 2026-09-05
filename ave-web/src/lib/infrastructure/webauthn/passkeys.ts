import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { credentialForVerification } from "./credential";

const PRF_SALT = new TextEncoder().encode("ave-master-key-prf-v1");
type PasskeyResponse = AuthenticationResponseJSON | RegistrationResponseJSON;
type PrfResult = { enabled?: boolean; results?: { first?: unknown } };

export const isWebAuthnSupported = browserSupportsWebAuthn;
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  try { return await platformAuthenticatorIsAvailable(); } catch { return false; }
}

function readPrf(response: PasskeyResponse): { prfSupported: boolean; prfOutput?: ArrayBuffer } {
  const prf = (response.clientExtensionResults as { prf?: PrfResult }).prf;
  const first = prf?.results?.first;
  let bytes: Uint8Array | undefined;
  if (first instanceof ArrayBuffer) {
    bytes = new Uint8Array(first);
  } else if (ArrayBuffer.isView(first)) {
    bytes = new Uint8Array(first.buffer, first.byteOffset, first.byteLength);
  } else if (Array.isArray(first) && first.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    bytes = new Uint8Array(first);
  } else if (typeof first === "string") {
    try {
      bytes = Uint8Array.from(atob(first.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
    } catch { }
  }
  return {
    prfSupported: prf?.enabled === true,
    prfOutput: bytes?.byteLength === 32 ? bytes.slice().buffer as ArrayBuffer : undefined,
  };
}

export async function registerPasskey(options: PublicKeyCredentialCreationOptionsJSON) {
  const optionsWithPrf = {
    ...options,
    extensions: { ...options.extensions, prf: { eval: { first: PRF_SALT } } },
  };
  const response = await startRegistration({ optionsJSON: optionsWithPrf });
  return { credential: credentialForVerification(response), ...readPrf(response) };
}

export async function authenticateWithPasskey(options: PublicKeyCredentialRequestOptionsJSON) {
  const optionsWithPrf = {
    ...options,
    extensions: { ...options.extensions, prf: { eval: { first: PRF_SALT } } },
  };
  const response = await startAuthentication({ optionsJSON: optionsWithPrf });
  return { credential: credentialForVerification(response), prfOutput: readPrf(response).prfOutput };
}

function bytesToBase64url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createLocalAuthenticationOptions(credentialId: string): PublicKeyCredentialRequestOptionsJSON {
  return {
    challenge: bytesToBase64url(crypto.getRandomValues(new Uint8Array(32))),
    rpId: window.location.hostname,
    allowCredentials: [
      {
        id: credentialId,
        type: "public-key",
      },
    ],
    userVerification: "required",
    timeout: 60000,
  };
}
