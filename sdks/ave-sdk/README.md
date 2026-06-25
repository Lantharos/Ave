# @ave-id/sdk

Typed helpers for Ave OAuth + OIDC flows.

## Install

```bash
bun add @ave-id/sdk
```

**What gets installed:** the package has **no** `dependencies` — not React, not Expo. **`expo-crypto`**, **`expo-auth-session`**, etc. are yours to add only for Expo ([`@ave-id/sdk/expo-session`](./src/expo-session.ts)). **`react`** is an **optional** `peerDependency` for **`@ave-id/sdk/next`** only; Svelte / vanilla / Node installs do not need React.

For Expo apps, also install:

```bash
bunx expo install expo-crypto
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

**Browser:** use **`expo-auth-session`**’s **`promptAsync()`** so Ave opens in **`expo-web-browser`** (Custom Tabs / SFSafariViewController). Call **`initExpoOAuthBrowserSession(WebBrowser)`** from **`@ave-id/sdk/expo-session`** at startup — see **`ave-docs/guides/expo-auth-session.mdx`** in this repository.

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

## Business workspaces

Apps can use Ave Business organizations as workspaces by passing `organizationId` during sign-in. Ave manages membership, roles, SSO policy, and org scopes; your app stores product data keyed by `org_id`.

If your app creates the workspace, show the user that it will create an Ave-managed workspace before calling `createAveWorkspaceOrganization`.

```ts
import { createAveWorkspaceOrganization, listAveWorkspaceOrganizations } from "@ave-id/sdk";
import { startPkceLogin } from "@ave-id/sdk/client";

let organizations = await listAveWorkspaceOrganizations(
  { clientId: "YOUR_CLIENT_ID" },
  tokens.access_token
);

if (!organizations.length) {
  const organization = await createAveWorkspaceOrganization(
    { clientId: "YOUR_CLIENT_ID" },
    tokens.access_token,
    {
      name: "Example Co",
      userConfirmedAveWorkspaceCreation: true,
    }
  );
  organizations = [organization];
}

await startPkceLogin({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
  scope: "openid profile email offline_access",
  organizationId: organizations[0]!.id,
});
```

On your server, verify the token and read the workspace context:

```ts
import { getAveWorkspaceContext, verifyAveIdTokenFromAuthHeader } from "@ave-id/sdk/server";

const principal = await verifyAveIdTokenFromAuthHeader(authorization, {
  clientId: "YOUR_CLIENT_ID",
});
const workspace = getAveWorkspaceContext(principal?.claims);
```

See `guides/business-workspaces` in the docs repo.

## App encryption

Enable `e2ee:symmetric` or `e2ee:asymmetric` in your authorize URL scope list. See [App encryption](/sdk/sdk-identity-keys).

```ts
import { buildAuthorizeUrl, encryptForAppHandle } from "@ave-id/sdk";

const url = buildAuthorizeUrl(
  { clientId: "YOUR_CLIENT_ID", redirectUri: "https://yourapp.com/callback" },
  { scope: ["openid", "profile", "email", "e2ee:asymmetric"] },
);

const wrapped = await encryptForAppHandle("secret", {
  clientId: "YOUR_CLIENT_ID",
  issuer: "https://aveid.net",
  handle: "alice",
});
```

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

## Next.js (App Router)

```tsx
"use client";
import { AveSessionProvider, AveConvexBridge } from "@ave-id/sdk/next";
import { createLocalStorageAdapter } from "@ave-id/sdk";
```

Peer dependency: **`react` >= 18**. See `guides/nextjs-ave-session` in the docs repo.

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
