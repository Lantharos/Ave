# @ave-id/sdk

Typed helpers for Ave OAuth + OIDC flows.

## Install

```bash
npm install @ave-id/sdk
```

For Expo apps, also install:

```bash
npx expo install expo-crypto
```

Then configure the SDK once during app startup:

```ts
import * as ExpoCrypto from "expo-crypto";
import { configureCryptoRuntime, createExpoCryptoRuntime } from "@ave-id/sdk";

configureCryptoRuntime(createExpoCryptoRuntime(ExpoCrypto));
```

This enables the SDK's PKCE helpers in Expo (`generateCodeVerifier`, `generateCodeChallenge`, and `generateNonce`). `verifyJwt()` still requires a runtime with `SubtleCrypto` RSA verification support.

On Expo native, `verifyJwt()` is not supported. The SDK's callback helpers skip client-side JWT verification in that runtime so successful logins do not fail after token exchange. If you need JWT signature verification, do it on your server or use a service like Convex that validates the `id_token` itself.

**SHA-256 for PKCE** uses Web Crypto in browsers; on Expo native you **must** call **`configureAveSdkForExpo(ExpoCrypto)`** from **`@ave-id/sdk/expo-session`** (or `configureCryptoRuntime(createExpoCryptoRuntime(ExpoCrypto))`) before `generateCodeChallenge` / `exchangeCode`. **`AveSession`** + **`completeExpoOAuthCallback`** live in **`@ave-id/sdk/expo-session`** for SecureStore and deep-link flows without `window`.

## Quick Ave (no app registration)

If you want the sign-in UI to stay inside your app, pair the SDK with `@ave-id/embed` and use `startAveAuth()` as the default entry point.

The fastest way to add Ave login — no developer portal, no client ID, no redirect-URI configuration. Works for rapid prototyping and upgrades cleanly to the full OIDC flow when you're ready.

```ts
// Protected page
import { getQuickIdentity, startQuickSignIn } from "@ave-id/sdk/client";

const user = getQuickIdentity();
if (!user) await startQuickSignIn();

console.log(user!.displayName, user!.email);
```

```ts
// /ave/callback page (the default callback path)
import { handleQuickCallback } from "@ave-id/sdk/client";

await handleQuickCallback(); // exchanges code, stores identity, redirects user back
```

The `clientId` is derived from your site's origin (`origin:https://yourapp.com`). PKCE provides the security — no secret is ever required. Quick Ave now verifies returned JWTs client-side against Ave's OIDC discovery document + JWKS before storing the session.

## Full OIDC flow

```ts
import {
  buildAuthorizeUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  exchangeCode,
} from "@ave-id/sdk";

const verifier = generateCodeVerifier();
const challenge = await generateCodeChallenge(verifier);

const url = buildAuthorizeUrl({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
}, {
  codeChallenge: challenge,
  codeChallengeMethod: "S256",
});

window.location.href = url;
```

## Client helpers

```ts
import { finishPkceLogin, signIn, startPkceLogin } from "@ave-id/sdk/client";

// Smart path: tries FedCM first, falls back to PKCE redirect when needed.
const fedcmResult = await signIn({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
});

if (fedcmResult) {
  console.log(fedcmResult.access_token);
}

await startPkceLogin({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
});

// On your callback page:
const tokens = await finishPkceLogin({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
});
```

`startPkceLogin()` now generates and stores both `state` and `nonce` by default, and `finishPkceLogin()` validates the callback `state`, exchanges the authorization code, and verifies any returned `id_token` / `access_token_jwt` with Ave's JWKS.

## Identity keys and wrapped payloads

Encrypt for the invitee’s public key, then pass the blob to Ave on the authorize URL as **`wrapped_key`** (see Mintlify docs: Identity keys & wrapped payloads). After consent, Ave returns plaintext in the redirect fragment as **`unwrapped_secret`** (or `unwrappedSecretB64` in embed). You do not unwrap on your own origin without the user’s Ave master key.

```ts
import { buildAuthorizeUrl } from "@ave-id/sdk";
import { encryptPayloadForHandle, encodeWrappedPayloadParam } from "@ave-id/sdk/client";

const wrapped = await encryptPayloadForHandle(
  new TextEncoder().encode(JSON.stringify({ secret: "…" })),
  { issuer: "https://aveid.net", handle: "alice" }
);

const url = buildAuthorizeUrl(
  { clientId: "YOUR_CLIENT_ID", redirectUri: "https://yourapp.com/callback" },
  {
    codeChallenge,
    codeChallengeMethod: "S256",
    extraParams: { wrapped_key: encodeWrappedPayloadParam(wrapped) },
  }
);
```

`decryptWrappedPayload` exists for local testing only; production flows use `wrapped_key` → Ave → `unwrapped_secret`.

## Server helpers

```ts
import { exchangeCodeServer } from "@ave-id/sdk/server";

const tokens = await exchangeCodeServer({
  clientId: "YOUR_CLIENT_ID",
  clientSecret: process.env.AVE_SECRET,
  redirectUri: "https://yourapp.com/callback",
}, {
  code: "CODE_FROM_CALLBACK",
});
```

## Ave Session (OAuth persistence and refresh)

For **Convex**, **Svelte**, **Expo**, or any app that must not reimplement refresh and rotation:

- Import **`AveSession`**, **`createLocalStorageAdapter`** (or **`createSecureStoreAdapter`** on native) from `@ave-id/sdk`.
- Call **`await session.hydrate()`** on startup, then **`await session.setTokensFromResponse(tokens)`** after `exchangeCode`.
- Use **`await session.getValidIdToken()`** wherever you need a non-expired **`id_token`** (e.g. wire to Convex).

```ts
import { AveSession, createLocalStorageAdapter } from "@ave-id/sdk";
import { completeOAuthCallback } from "@ave-id/sdk/client";
import { wireAveSessionToConvex } from "@ave-id/sdk/convex";

const session = new AveSession({
  oauth: { clientId: process.env.AVE_CLIENT_ID!, redirectUri: "https://yourapp.com/callback" },
  storage: createLocalStorageAdapter(),
  devtools: true,
});

await completeOAuthCallback(session, {
  clientId: process.env.AVE_CLIENT_ID!,
  redirectUri: "https://yourapp.com/callback",
});

await session.hydrate();
wireAveSessionToConvex(convex, session);

session.getAppKeyBase64(); // E2EE, if present on redirect
```

**`finishPkceLogin`** (used by `completeOAuthCallback`) merges **`#app_key`** from the callback URL into tokens and clears sensitive fragment parameters.

See the Mintlify guide **Ave Session** in the repository docs (`guides/ave-session-and-tokens`).

## Verify JWTs with the SDK

```ts
import { verifyJwt } from "@ave-id/sdk";

const claims = await verifyJwt(token, {
  audience: "origin:https://yourapp.com", // or your registered client ID / API audience
  nonce: "EXPECTED_NONCE", // optional, for id_token validation
});

if (!claims) {
  throw new Error("Invalid Ave JWT");
}
```

`verifyJwt()` uses Ave's issuer/discovery default when `issuer` is omitted, fetches JWKS automatically, validates the RS256 signature, checks `iss`, `exp`, optional `nbf`, and enforces the `aud` / `nonce` values you provide. Server usage requires runtime `fetch` and WebCrypto (`globalThis.crypto.subtle`), which are built into current Workers/browsers and modern Node releases.
