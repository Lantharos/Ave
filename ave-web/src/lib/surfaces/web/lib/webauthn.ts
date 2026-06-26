/**
 * WebAuthn helpers for passkey authentication
 */

import { startRegistration, startAuthentication, bufferToBase64URLString, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

// PRF salt for master key encryption (static, application-wide)
// This salt is combined with the passkey's unique PRF to derive a unique key per passkey
const PRF_SALT = new TextEncoder().encode("ave-master-key-prf-v1");

/**
 * Check if WebAuthn is supported
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === "function"
  );
}

/**
 * Check if platform authenticator (built-in passkey) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Generate a random PRF salt for a new passkey
 */
export function generatePrfSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...salt));
}

/**
 * Convert base64url string to Uint8Array
 * Base64url uses - and _ instead of + and /, and has no padding
 * Also handles ArrayBuffer/Uint8Array inputs directly
 */
function coalesceToBytes(input: unknown): Uint8Array | undefined {
  if (input instanceof Uint8Array) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }

  if (typeof input !== "string") {
    return undefined;
  }

  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");

  while (base64.length % 4) {
    base64 += "=";
  }

  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function coalesceToBase64UrlString(input: unknown): string | null {
  if (typeof input === "string") {
    return input;
  }

  const bytes = coalesceToBytes(input);
  if (!bytes) {
    return null;
  }

  return bufferToBase64URLString(toArrayBuffer(bytes));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function normalizeAuthenticationOptionsJSON(
  options: PublicKeyCredentialRequestOptions,
): PublicKeyCredentialRequestOptionsJSON {
  const challenge = coalesceToBase64UrlString(options.challenge);
  if (!challenge) {
    throw new Error("Invalid WebAuthn challenge");
  }

  return {
    ...options,
    challenge,
    allowCredentials: options.allowCredentials?.map((credential) => {
      const id = coalesceToBase64UrlString(credential.id);
      if (!id) {
        throw new Error("Invalid WebAuthn credential id");
      }
      return {
        ...credential,
        id,
      };
    }),
  } as PublicKeyCredentialRequestOptionsJSON;
}

function base64urlToBytes(input: unknown): Uint8Array {
  const bytes = coalesceToBytes(input);
  if (!bytes) {
    throw new Error("Invalid PRF output format");
  }
  return bytes;
}

/**
 * Register a new passkey with PRF extension support
 */
export async function registerPasskey(
  options: PublicKeyCredentialCreationOptions
): Promise<{ credential: Credential; prfSupported: boolean; prfOutput?: ArrayBuffer }> {
  // Add PRF extension to the options
  const optionsWithPrf = {
    ...options,
    extensions: {
      ...((options as any).extensions || {}),
      prf: {
        eval: {
          first: PRF_SALT,
        },
      },
    },
  };
  
  const response = await startRegistration({
    optionsJSON: optionsWithPrf as any,
  });
  
  // Check if PRF was supported
  const extensions = (response as any).clientExtensionResults;
  const prfResult = extensions?.prf;
  const prfSupported = prfResult?.enabled === true;
  let prfOutput: ArrayBuffer | undefined;
  
  if (prfSupported && prfResult?.results?.first) {
    const prfBytes = base64urlToBytes(prfResult.results.first);
    prfOutput = toArrayBuffer(prfBytes);
  }
  
  return {
    credential: response as unknown as Credential,
    prfSupported,
    prfOutput,
  };
}

/**
 * Authenticate with a passkey, optionally requesting PRF output
 */
export async function authenticateWithPasskey(
  options: PublicKeyCredentialRequestOptions,
  requestPrf: boolean = false,
  prfSalt?: string
): Promise<{ credential: Credential; prfOutput?: ArrayBuffer }> {
  const normalizedOptions = normalizeAuthenticationOptionsJSON(options);
  const optionsToUse = requestPrf
    ? {
        ...normalizedOptions,
        extensions: {
          ...((normalizedOptions as PublicKeyCredentialRequestOptionsJSON & { extensions?: Record<string, unknown> }).extensions || {}),
          prf: {
            eval: {
              first: toArrayBuffer(prfSalt ? base64urlToBytes(prfSalt) : PRF_SALT),
            },
          },
        },
      }
    : normalizedOptions;
  
  const response = await startAuthentication({
    optionsJSON: optionsToUse as Parameters<typeof startAuthentication>[0]["optionsJSON"],
  });
  
  let prfOutput: ArrayBuffer | undefined;
  
  if (requestPrf) {
    const extensions = (response as any).clientExtensionResults;
    const prfResult = extensions?.prf;
    if (prfResult?.results?.first) {
      const prfBytes = base64urlToBytes(prfResult.results.first);
      prfOutput = toArrayBuffer(prfBytes);
    }
  }
  
  return {
    credential: response as unknown as Credential,
    prfOutput,
  };
}

/**
 * Get or generate a persistent device fingerprint
 * This is stored in localStorage and uniquely identifies this browser on this device
 */
function getDeviceFingerprint(): string {
  const STORAGE_KEY = "ave_device_fingerprint";
  let fingerprint = localStorage.getItem(STORAGE_KEY);
  
  if (!fingerprint) {
    // Generate a new fingerprint (UUID v4 style)
    fingerprint = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, fingerprint);
  }
  
  return fingerprint;
}

/**
 * Get device info for registration/login
 */
export function getDeviceInfo(): {
  name: string;
  type: "phone" | "computer" | "tablet";
  browser: string;
  os: string;
  fingerprint: string;
} {
  const ua = navigator.userAgent;
  
  // Detect browser
  let browser = "Unknown Browser";
  if (ua.includes("Chrome") && !ua.includes("Edg")) {
    browser = "Chrome";
  } else if (ua.includes("Firefox")) {
    browser = "Firefox";
  } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
    browser = "Safari";
  } else if (ua.includes("Edg")) {
    browser = "Edge";
  } else if (ua.includes("Opera") || ua.includes("OPR")) {
    browser = "Opera";
  }
  
  // Detect OS
  let os = "Unknown OS";
  if (ua.includes("Windows")) {
    os = "Windows";
  } else if (ua.includes("Mac OS")) {
    os = "macOS";
  } else if (ua.includes("Linux") && !ua.includes("Android")) {
    os = "Linux";
  } else if (ua.includes("Android")) {
    os = "Android";
  } else if (ua.includes("iPhone") || ua.includes("iPad")) {
    os = "iOS";
  }
  
  // Detect device type
  let type: "phone" | "computer" | "tablet" = "computer";
  if (/Mobi|Android/i.test(ua) && !/Tablet|iPad/i.test(ua)) {
    type = "phone";
  } else if (/Tablet|iPad/i.test(ua)) {
    type = "tablet";
  }
  
  // Generate device name
  const name = `${browser} on ${os}`;
  
  // Get persistent fingerprint for this device/browser
  const fingerprint = getDeviceFingerprint();
  
  return { name, type, browser, os, fingerprint };
}
