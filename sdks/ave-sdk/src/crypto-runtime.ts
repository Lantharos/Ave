import { sha256Pure } from "./sha256-pure.js";

export interface AveCryptoRuntime {
  getRandomValues?<T extends Uint8Array>(array: T): T;
  digestSha256?(input: Uint8Array): Promise<ArrayBuffer | Uint8Array>;
  subtle?: SubtleCrypto | null;
}

interface ExpoCryptoLike {
  getRandomValues<T extends Uint8Array>(array: T): T;
  digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
  CryptoDigestAlgorithm?: {
    SHA256?: string;
  };
}

let configuredCryptoRuntime: AveCryptoRuntime | null = null;

export function configureCryptoRuntime(runtime: AveCryptoRuntime | null): void {
  configuredCryptoRuntime = runtime;
}

export function createExpoCryptoRuntime(expoCrypto: ExpoCryptoLike): AveCryptoRuntime {
  const sha256Algorithm = expoCrypto.CryptoDigestAlgorithm?.SHA256 ?? "SHA-256";

  return {
    getRandomValues(array) {
      return expoCrypto.getRandomValues(array);
    },
    async digestSha256(input) {
      return expoCrypto.digest(sha256Algorithm, input);
    },
  };
}

function getGlobalCrypto(): Crypto | undefined {
  return (
    globalThis as typeof globalThis & {
      crypto?: Crypto;
    }
  ).crypto;
}

function toUint8Array(value: ArrayBuffer | Uint8Array): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

function toBufferSource(input: Uint8Array): BufferSource {
  return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
}

async function importNodeCrypto(): Promise<any | null> {
  try {
    const loadNodeCrypto = Function("return import('node:crypto')") as () => Promise<any>;
    return await loadNodeCrypto();
  } catch {
    return null;
  }
}

async function digestSha256WithSubtle(subtle: SubtleCrypto, input: Uint8Array): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(
      await subtle.digest("SHA-256", toBufferSource(input)),
    );
  } catch {
    return null;
  }
}

async function digestSha256WithNode(input: Uint8Array): Promise<Uint8Array | null> {
  const nodeCrypto = await importNodeCrypto();
  if (!nodeCrypto) {
    return null;
  }

  if (typeof nodeCrypto.createHash === "function") {
    return new Uint8Array(nodeCrypto.createHash("sha256").update(input).digest());
  }

  const webcrypto = nodeCrypto.webcrypto as Crypto | undefined;
  if (webcrypto?.subtle) {
    return digestSha256WithSubtle(webcrypto.subtle, input);
  }

  return null;
}

function cryptoRuntimeError(kind: "random" | "sha256"): Error {
  const secureContext =
    typeof globalThis !== "undefined" &&
    "isSecureContext" in globalThis &&
    (globalThis as typeof globalThis & { isSecureContext?: boolean }).isSecureContext === false;

  if (kind === "random") {
    return new Error(
      secureContext
        ? "[Ave] No secure random source is available. Use HTTPS or configure configureCryptoRuntime(createExpoCryptoRuntime(ExpoCrypto)) in Expo."
        : "[Ave] No secure random source is available. In Expo, install expo-crypto and call configureCryptoRuntime(createExpoCryptoRuntime(ExpoCrypto)) during app startup.",
    );
  }

  return new Error(
    secureContext
      ? "[Ave] SHA-256 is unavailable in this runtime. PKCE requires a secure context (HTTPS) or configureCryptoRuntime(createExpoCryptoRuntime(ExpoCrypto)) in Expo."
      : "[Ave] No SHA-256 implementation is available in this runtime. In Expo, install expo-crypto and call configureCryptoRuntime(createExpoCryptoRuntime(ExpoCrypto)) during app startup.",
  );
}

export function fillRandomValues<T extends Uint8Array>(array: T): T {
  const globalCrypto = getGlobalCrypto();
  if (globalCrypto?.getRandomValues) {
    globalCrypto.getRandomValues(array as any);
    return array;
  }

  if (configuredCryptoRuntime?.getRandomValues) {
    return configuredCryptoRuntime.getRandomValues(array);
  }

  throw cryptoRuntimeError("random");
}

export async function digestSha256(input: Uint8Array): Promise<Uint8Array> {
  const globalCrypto = getGlobalCrypto();
  if (globalCrypto?.subtle) {
    const digest = await digestSha256WithSubtle(globalCrypto.subtle, input);
    if (digest) {
      return digest;
    }
  }

  if (configuredCryptoRuntime?.digestSha256) {
    return toUint8Array(await configuredCryptoRuntime.digestSha256(input));
  }

  const nodeDigest = await digestSha256WithNode(input);
  if (nodeDigest) {
    return nodeDigest;
  }

  return sha256Pure(input);
}

export async function resolveSubtleCrypto(): Promise<SubtleCrypto | null> {
  const globalCrypto = getGlobalCrypto();
  if (globalCrypto?.subtle) {
    return globalCrypto.subtle;
  }

  if (configuredCryptoRuntime?.subtle) {
    return configuredCryptoRuntime.subtle;
  }

  const nodeCrypto = await importNodeCrypto();
  return (nodeCrypto?.webcrypto as Crypto | undefined)?.subtle ?? null;
}

export async function isJwtVerificationSupported(): Promise<boolean> {
  return (await resolveSubtleCrypto()) !== null;
}
