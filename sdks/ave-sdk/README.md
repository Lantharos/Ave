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

The `clientId` is derived from your site's origin (`origin:https://yourapp.com`). PKCE provides the security — no secret is ever required.

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
import { startPkceLogin } from "@ave-id/sdk/client";

await startPkceLogin({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
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
