# @ave-id/sdk

Typed helpers for Ave OAuth + OIDC flows.

## Install

```bash
npm install @ave-id/sdk
```

## Quick Ave (no app registration)

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
import { finishPkceLogin, startPkceLogin } from "@ave-id/sdk/client";

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

`verifyJwt()` uses Ave's issuer/discovery defaults when `issuer` is omitted, fetches JWKS automatically, validates the RS256 signature, checks `iss`, `exp`, optional `nbf`, and enforces the `aud` / `nonce` values you provide.
