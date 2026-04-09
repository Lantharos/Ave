import { timingSafeEqual } from "node:crypto";

const DEFAULT_DEMO_HANDLE = "demo";

export function getDemoHandle(): string {
  return (process.env.DEMO_HANDLE || DEFAULT_DEMO_HANDLE).trim().toLowerCase();
}

export function getDemoPassword(): string | null {
  const password = process.env.DEMO_PASSWORD?.trim();
  return password ? password : null;
}

export function isDemoLoginEnabled(): boolean {
  return !!getDemoPassword();
}

export function isDemoHandle(handle: string): boolean {
  return handle.trim().toLowerCase() === getDemoHandle();
}

export function verifyDemoPassword(password: string): boolean {
  const expectedPassword = getDemoPassword();
  if (!expectedPassword) {
    return false;
  }

  const provided = Buffer.from(password);
  const expected = Buffer.from(expectedPassword);
  const maxLength = Math.max(provided.length, expected.length);
  const paddedProvided = Buffer.alloc(maxLength);
  const paddedExpected = Buffer.alloc(maxLength);
  provided.copy(paddedProvided);
  expected.copy(paddedExpected);

  return timingSafeEqual(paddedProvided, paddedExpected) && provided.length === expected.length;
}
