declare module "expo-modules-core" {
  export function requireNativeModule<T = any>(name: string): T;
}

declare module "react-native" {
  export const Platform: { OS: string };
  export const Linking: { openURL(url: string): Promise<void> };
}
