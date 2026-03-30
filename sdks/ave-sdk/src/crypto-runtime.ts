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

async function importNodeCrypto(): Promise<any | null> {
  try {
    const loadNodeCrypto = Function("return import('node:crypto')") as () => Promise<any>;
    return await loadNodeCrypto();
  } catch {
    return null;
  }
}

export function fillRandomValues<T extends Uint8Array>(array: T): T {
  const globalCrypto = getGlobalCrypto();
  if (globalCrypto?.getRandomValues) {
    return globalCrypto.getRandomValues(array);
  }

  if (configuredCryptoRuntime?.getRandomValues) {
    return configuredCryptoRuntime.getRandomValues(array);
  }

  throw new Error(
    "[Ave] No secure random source is available in this runtime. In Expo, install expo-crypto and call configureCryptoRuntime(createExpoCryptoRuntime(ExpoCrypto)) during app startup.",
  );
}

export async function digestSha256(input: Uint8Array): Promise<Uint8Array> {
  const globalCrypto = getGlobalCrypto();
  if (globalCrypto?.subtle) {
    return new Uint8Array(
      await globalCrypto.subtle.digest("SHA-256", input as unknown as BufferSource),
    );
  }

  if (configuredCryptoRuntime?.digestSha256) {
    return toUint8Array(await configuredCryptoRuntime.digestSha256(input));
  }

  const nodeCrypto = await importNodeCrypto();
  const webcrypto = nodeCrypto?.webcrypto as Crypto | undefined;
  if (webcrypto?.subtle) {
    return new Uint8Array(
      await webcrypto.subtle.digest("SHA-256", input as unknown as BufferSource),
    );
  }

  throw new Error(
    "[Ave] No SHA-256 implementation is available in this runtime. In Expo, install expo-crypto and call configureCryptoRuntime(createExpoCryptoRuntime(ExpoCrypto)) during app startup.",
  );
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
