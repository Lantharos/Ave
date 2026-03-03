import { requireNativeModule } from "expo-modules-core";
import { Linking, Platform } from "react-native";
import type { AveAuthOptions, AveAuthResult } from "./types";

type NativeBridge = {
  isAveInstalledAsync(): Promise<boolean>;
  authenticateAsync(scope: string, interactive: boolean): Promise<AveAuthResult>;
};

const NativeModule = (() => {
  try {
    return requireNativeModule<NativeBridge>("AveAuthBridge");
  } catch {
    return null;
  }
})();

export async function isAveInstalledAsync(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return false;
  }
  if (!NativeModule) {
    return false;
  }
  return NativeModule.isAveInstalledAsync();
}

export async function authenticateWithAveAsync(
  options: AveAuthOptions = {}
): Promise<AveAuthResult> {
  const scope = options.scope || "openid profile email";
  const interactive = options.interactive ?? true;

  if (Platform.OS !== "android") {
    const fallback = options.browserFallbackUrl || "https://aveid.net/login";
    await Linking.openURL(fallback);
    throw new Error("Ave native auth is not available on this platform");
  }

  if (!NativeModule) {
    const fallback = options.browserFallbackUrl || "https://aveid.net/login";
    await Linking.openURL(fallback);
    throw new Error("Ave auth bridge module is unavailable");
  }

  const installed = await NativeModule.isAveInstalledAsync();
  if (!installed) {
    const fallback = options.browserFallbackUrl || "https://aveid.net/login";
    await Linking.openURL(fallback);
    throw new Error("Ave app is not installed on this device");
  }

  return NativeModule.authenticateAsync(scope, interactive);
}

export type { AveAuthOptions, AveAuthResult } from "./types";
