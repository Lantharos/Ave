# @ave-id/embed

Ave sign-in, Connector consent, and signing in an iframe, sheet, or popup.

```bash
bun add @ave-id/embed
```

## Sign in

`startAveAuth()` opens a sheet and handles PKCE, state, nonce, and the code exchange when you provide `onTokens`. Omit `clientId` to use Quick Ave for your callback's origin.

```js
import { startAveAuth } from "@ave-id/embed";

const auth = await startAveAuth({
  redirectUri: "https://yourapp.com/callback",
  onTokens: (tokens) => {
    createSession(tokens);
  },
  onError: ({ message }) => showError(message),
});
```

Registered apps can request encryption scopes. `onTokens` includes the granted `app_key`, `app_public_key`, and `app_private_key` fields from the callback fragment, along with any previous keys and `app_key_reset` recovery flag. These keys stay in the browser; the SDK sends only the authorization code and PKCE verifier to the token endpoint.

Profile and email fields in `tokens.user` depend on the granted scopes. Use `@ave-id/sdk` to verify returned JWTs before relying on their claims.

## Choose a presentation

- `startAveAuth(options)`: sheet by default, inline iframe when `container` is provided.
- `mountAveEmbed(options)`: inline iframe; requires a container.
- `openAveSheet(options)`: modal sheet.
- `openAvePopup(options)`: separate window; resolves to `null` when blocked.

These four functions return promises. Await them to use the returned controls.

```js
import { mountAveEmbed, openAvePopup } from "@ave-id/embed";

const inline = await mountAveEmbed({
  container: document.getElementById("ave-embed"),
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
  onTokens: createSession,
});

inline.destroy();

const popup = await openAvePopup({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
  onTokens: createSession,
  onError: ({ message }) => showError(message),
});

popup?.close();
```

Call popup helpers from a click handler. The auth popup opens before asynchronous PKCE preparation to retain the browser's user activation. Sheets and inline embeds can open a popup when Ave needs a full browser context. If that popup is blocked during an `onTokens` flow, `onError` receives `popup_blocked`; allow popups and start the flow again.

`onClose` fires once when a flow is dismissed, including manual popup closure. Completing or failing a flow calls its result callback without also calling `onClose`.

## Use your own callback

Provide `onSuccess` instead of `onTokens` when your app handles the callback and code exchange. Confidential clients can exchange the code on their server. Public clients must generate and persist a PKCE verifier and validate their own state and nonce.

```js
import { openAveSheet } from "@ave-id/embed";
import { generateCodeChallenge, generateCodeVerifier } from "@ave-id/sdk";

const verifier = generateCodeVerifier();
const state = crypto.randomUUID();
const nonce = crypto.randomUUID();
sessionStorage.setItem("ave_code_verifier", verifier);
sessionStorage.setItem("ave_state", state);
sessionStorage.setItem("ave_nonce", nonce);

await openAveSheet({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
  codeChallenge: await generateCodeChallenge(verifier),
  codeChallengeMethod: "S256",
  extraParams: { state, nonce },
  onSuccess: ({ redirectUrl }) => window.location.assign(redirectUrl),
});
```

For an application-managed callback, a sheet or inline embed redirects the current page to Ave if the required popup is blocked. Your persisted callback state must survive that navigation. Keep `redirectUri` identical during authorization and exchange.

## Connector consent

Connector sheets and popups return controls synchronously. They open `/connect` to request access to a downstream resource.

```js
import { openAveConnectorSheet } from "@ave-id/embed";

const connector = openAveConnectorSheet({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
  resource: "target:resource",
  scope: "resource.access",
  mode: "user_present",
  onSuccess: ({ redirectUrl }) => window.location.assign(redirectUrl),
  onError: ({ message }) => showError(message),
});
```

`openAveConnectorPopup` accepts the same options plus `width` and `height`, and returns `null` if blocked.

## Signing

```js
import { openAveSigningSheet } from "@ave-id/embed";

const signing = openAveSigningSheet({
  requestId: "SIGNING_REQUEST_ID",
  onSigned: (result) => acceptSignature(result),
  onDenied: (error) => showError(error.message),
});
```

`openAveSigningPopup` has the same callbacks and accepts `width` and `height`. Both helpers return controls synchronously and send the embedding origin with the signing request.

## Connector runtime

```js
import { openAveConnectorRuntime } from "@ave-id/embed";

const runtime = openAveConnectorRuntime({
  delegatedToken: "DELEGATED_TOKEN",
  target: "iris",
  onReady: () => runtime.send({
    id: "request-1",
    mode: "stream",
    messages: [{ role: "user", content: "hello" }],
  }),
  onEvent: (event) => renderResult(event),
});

runtime.destroy();
```

`destroy()` removes the frame and its listeners. Each embed accepts messages only from its configured Ave origin and its own iframe or popup, so simultaneous flows remain separate.

## Common options

- `clientId`, `redirectUri`: app and exact callback URL for auth and Connector flows.
- `scope`: defaults to `openid profile email` for auth or `resource.access` for Connector.
- `issuer`: defaults to `https://aveid.net`.
- `theme`: defaults to `dark` for auth.
- `width`, `height`: inline dimensions or popup dimensions, depending on the helper.
- `onTokens`, `onSuccess`, `onError`, `onClose`: auth callbacks; `onTokens` takes precedence over `onSuccess`.

The package has no runtime dependencies. Build it with `bun run build` on Linux, macOS, or Windows.
