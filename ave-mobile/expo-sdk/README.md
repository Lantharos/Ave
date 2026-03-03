# @aveid/expo-auth-bridge

Expo native module for cross-app Ave auth.

## API

- `isAveInstalledAsync()`
- `authenticateWithAveAsync({ scope, interactive, browserFallbackUrl })`

## Android

The module binds to `net.aveid.auth.BIND` and requests auth through AIDL.

## iOS and missing app fallback

If native auth is unavailable, the module opens `browserFallbackUrl` or `https://aveid.net/login`.
