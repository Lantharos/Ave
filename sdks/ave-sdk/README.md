# @ave-id/sdk

Typed helpers for Ave OAuth + OIDC flows.

## Install

```bash
npm install @ave-id/sdk
```

## Example

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
