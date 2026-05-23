import type { Device } from "./api";

const STORAGE_KEY = "ave_pending_passkey_setup";

export interface PendingPasskeySetupPrompt {
  deviceId: string;
  deviceName: string;
  queuedAt: number;
}

export function queuePasskeySetupPrompt(device: Device): void {
  if (!device.isNew) return;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      deviceId: device.id,
      deviceName: device.name,
      queuedAt: Date.now(),
    }));
  } catch {
  }
}

export function readPendingPasskeySetupPrompt(): PendingPasskeySetupPrompt | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PendingPasskeySetupPrompt;
    if (!parsed.deviceId || !parsed.deviceName) {
      clearPendingPasskeySetupPrompt();
      return null;
    }

    return parsed;
  } catch {
    clearPendingPasskeySetupPrompt();
    return null;
  }
}

export function clearPendingPasskeySetupPrompt(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
  }
}
