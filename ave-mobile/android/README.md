# Ave Android Auth Service

This module defines the native Android surface for cross-app auth with Ave.

## Public Contract

- Action: `net.aveid.auth.BIND`
- Service: `net.aveid.auth.service.AveAuthService`
- Permission: `net.aveid.permission.BIND_AUTH_SERVICE` (signature)
- AIDL: `IAveAuthService`, `IAveAuthCallback`

## Behavior

- If user session is valid, service returns token silently.
- If interaction is required, service launches `AuthorizeSheetActivity` and completes callback after decision.
- Calling package is verified against Binder UID.
