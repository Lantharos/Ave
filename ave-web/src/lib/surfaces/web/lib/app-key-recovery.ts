import { get } from "svelte/store";
import { api } from "./api";
import {
  encryptAppKey,
  exportAppKey,
  importAppKey,
  resolveActiveMasterKey,
} from "./crypto";
import { auth } from "../stores/auth";

export type AppKeyRecoveryInput = {
  clientId: string;
  appKey?: string;
  identityId?: string;
};

function normalizeAppKey(value: string): string {
  const normalized = value
    .trim()
    .replace(/[\r\n\t]/g, "")
    .replace(/ /g, "+")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
}

async function fingerprintAppKey(appKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", appKey);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function promptForRecoveredAppKey(): string {
  const appKey = window.prompt("Paste the recovered Base64 app key");
  if (!appKey?.trim()) throw new Error("App key recovery was cancelled");
  return appKey;
}

async function readRecoveredAppKey(appKey?: string): Promise<string> {
  if (appKey?.trim()) return appKey;

  let clipboardAppKey: string;
  try {
    clipboardAppKey = await navigator.clipboard.readText();
  } catch {
    return promptForRecoveredAppKey();
  }

  return clipboardAppKey.trim() ? clipboardAppKey : promptForRecoveredAppKey();
}

export async function recoverAppKey({
  clientId,
  appKey,
  identityId,
}: AppKeyRecoveryInput): Promise<{
  clientId: string;
  identityId: string;
  fingerprint: string;
}> {
  if (!clientId.trim()) throw new Error("clientId is required");

  const recoveredAppKey = await readRecoveredAppKey(appKey);

  const authState = get(auth);
  if (!authState.isAuthenticated) {
    throw new Error("Sign in to Ave before recovering an app key");
  }

  const identity = identityId
    ? authState.identities.find((candidate) => candidate.id === identityId)
    : authState.currentIdentity;
  if (!identity) {
    throw new Error("The requested Ave identity is not available in this session");
  }

  const masterKey = await resolveActiveMasterKey(authState.masterKey);
  if (!masterKey) {
    throw new Error("Unlock your Ave encryption key on this device first");
  }

  const recoveredKey = await importAppKey(normalizeAppKey(recoveredAppKey));
  const canonicalKey = await exportAppKey(recoveredKey);
  if (Uint8Array.from(atob(canonicalKey), (character) => character.charCodeAt(0)).length !== 32) {
    throw new Error("The recovered app key must be a 32-byte AES key");
  }

  const encryptedAppKey = await encryptAppKey(recoveredKey, masterKey);
  await api.oauth.recoverSymmetricAppKey({
    clientId: clientId.trim(),
    identityId: identity.id,
    encryptedAppKey,
    confirmRecovery: true,
  });

  return {
    clientId: clientId.trim(),
    identityId: identity.id,
    fingerprint: await fingerprintAppKey(recoveredKey),
  };
}

export function installAppKeyRecoveryConsole(): void {
  if (typeof window === "undefined") return;
  window.aveRecoverAppKey = recoverAppKey;
}

declare global {
  interface Window {
    aveRecoverAppKey: typeof recoverAppKey;
  }
}
