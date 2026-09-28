# @ave-id/sdk

TypeScript SDK for [Ave](https://aveid.net): passkey sign-in over OAuth 2.0 and OpenID Connect, with per-user end-to-end encryption keys delivered straight to your client code.

When your app requests an encryption scope, Ave unwraps the user's key for your app on their device and hands it to your callback in the URL fragment. Ave's servers store it only encrypted by the user's master key, and it never passes through your backend.

```bash
bun add @ave-id/sdk
```

The package has no dependencies and runs in browsers, Workers, Node, Bun, and Expo.

## Sign in and receive an encryption key

Register your app and its callback URL at [devs.aveid.net](https://devs.aveid.net), then:

```ts
import { AveSession, createLocalStorageAdapter } from "@ave-id/sdk";
import { completeOAuthCallback, startPkceLogin } from "@ave-id/sdk/client";

const oauth = { clientId: "YOUR_CLIENT_ID", redirectUri: "https://yourapp.com/callback" };
const session = new AveSession({ oauth, storage: createLocalStorageAdapter() });

// Sign-in button
await startPkceLogin({ ...oauth, scope: "openid profile offline_access e2ee:symmetric" });

// Callback page: checks state, exchanges the code, verifies the JWTs,
// reads the key from the fragment, and removes it from the address bar
await completeOAuthCallback(session, oauth);

const appKeyBase64 = session.getAppKeyBase64();
```

Import the key with Web Crypto and encrypt with AES-GCM before data leaves the device:

```ts
const raw = Uint8Array.from(atob(appKeyBase64!), (c) => c.charCodeAt(0));
const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
```

On later page loads, `await session.hydrate()` restores tokens and keys, and `await session.getValidIdToken()` returns a fresh `id_token`, refreshing first when needed.

## Encrypt for other users

Request `e2ee:asymmetric` to give each user a P-256 keypair for your app. Other users can then encrypt for them by handle:

```ts
import { decryptFromAppSender, encryptForAppHandle } from "@ave-id/sdk";

const envelope = await encryptForAppHandle("room key", { clientId: "YOUR_CLIENT_ID", handle: "alice" });

// Alice, with her own session
const plaintext = await decryptFromAppSender(envelope, session.getAppPrivateKeyBase64()!);
```

`lookupAppPublicKeyByHandle` and `lookupAppUserByPublicKey` expose the lookup directly and throw `AppEncryptionLookupError` with `status === 404` when someone has not used your app yet.

## Verify tokens on your server

```ts
import { verifyAveIdTokenFromAuthHeader } from "@ave-id/sdk/server";

const principal = await verifyAveIdTokenFromAuthHeader(request.headers.get("authorization"), {
  clientId: process.env.AVE_CLIENT_ID!,
});
if (!principal) return new Response("Unauthorized", { status: 401 });

principal.subject; // identity ID
```

Confidential clients exchange codes and refresh tokens with `exchangeCodeServer` and `refreshTokenServer`. Keep the client secret on the server.

## Lower-level OAuth

```ts
import { buildAuthorizeUrl, generateCodeChallenge, generateCodeVerifier, generateNonce } from "@ave-id/sdk";

const verifier = generateCodeVerifier();
const url = buildAuthorizeUrl(
  { clientId: "YOUR_CLIENT_ID", redirectUri: "https://yourapp.com/callback" },
  {
    scope: ["openid", "profile", "e2ee:symmetric"],
    state: generateNonce(),
    nonce: generateNonce(),
    codeChallenge: await generateCodeChallenge(verifier),
    codeChallengeMethod: "S256",
  },
);
```

After the callback, `exchangeCode` returns the tokens, `mergeAppEncryptionFromUrl` adds the keys from the fragment, `stripSensitiveFragmentParams` removes them from the URL, and `verifyJwt` checks the `id_token` against Ave's JWKS.

## Integrations

| Import | Purpose |
| --- | --- |
| `@ave-id/sdk/convex` | `wireAveSessionToConvex` keeps Convex supplied with a fresh `id_token` |
| `@ave-id/sdk/svelte` | `aveSessionToStore` exposes session state as a Svelte store |
| `@ave-id/sdk/expo-session` | `configureAveSdkForExpo`, `completeExpoOAuthCallback`, and a SecureStore adapter |
| `@ave-id/sdk/expo-lifecycle` | `onExpoAppForegroundRefresh` refreshes when the app returns to the foreground |

Expo native has no Web Crypto digest. Install `expo-crypto` and configure the SDK once at startup:

```ts
import * as ExpoCrypto from "expo-crypto";
import { configureAveSdkForExpo } from "@ave-id/sdk/expo-session";

configureAveSdkForExpo(ExpoCrypto);
```

`verifyJwt` needs RSA verification from `SubtleCrypto`, so the Expo callback helpers skip client-side JWT verification. Verify the `id_token` on your server instead.

## Documentation

- [Quickstart](https://docs.aveid.net/quickstart)
- [End-to-end encryption](https://docs.aveid.net/guides/end-to-end-encryption)
- [App encryption reference](https://docs.aveid.net/sdk/sdk-identity-keys)
- [OAuth reference](https://docs.aveid.net/sdk/sdk-oauth)
- [Ave Session](https://docs.aveid.net/guides/ave-session-and-tokens)
- [Expo with AuthSession](https://docs.aveid.net/guides/expo-auth-session)
