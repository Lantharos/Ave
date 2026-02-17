import AsyncStorage from "@react-native-async-storage/async-storage";
import { masterKeyFromB64, masterKeyToB64 } from "./crypto";

const SESSION_KEY = "ave_mobile_session_token";
const HANDLE_KEY = "ave_mobile_handle";
const MASTER_KEY = "ave_mobile_master_key_raw";

export async function saveSession(token: string, handle: string): Promise<void> {
  await AsyncStorage.multiSet([
    [SESSION_KEY, token],
    [HANDLE_KEY, handle],
  ]);
}

export async function loadSession(): Promise<{ token: string | null; handle: string | null }> {
  const values = await AsyncStorage.multiGet([SESSION_KEY, HANDLE_KEY]);
  const token = values.find(([k]) => k === SESSION_KEY)?.[1] ?? null;
  const handle = values.find(([k]) => k === HANDLE_KEY)?.[1] ?? null;
  return { token, handle };
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([SESSION_KEY, HANDLE_KEY, MASTER_KEY]);
}

export async function saveMasterKeyRaw(masterKeyRaw: Uint8Array): Promise<void> {
  await AsyncStorage.setItem(MASTER_KEY, masterKeyToB64(masterKeyRaw));
}

export async function loadMasterKeyRaw(): Promise<Uint8Array | null> {
  const encoded = await AsyncStorage.getItem(MASTER_KEY);
  if (!encoded) return null;
  try {
    return masterKeyFromB64(encoded);
  } catch {
    return null;
  }
}
