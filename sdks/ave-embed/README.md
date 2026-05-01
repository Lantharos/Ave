# @ave-id/embed

Lightweight iframe embed for Ave sign-in with postMessage callbacks.

## Install

```bash
bun add @ave-id/embed
```

## Recommended default

Use `startAveAuth()` unless you specifically need an always-mounted iframe.

It starts with the sheet flow, opens a popup when Ave needs a top-level browser context, and falls back to a redirect if the popup is blocked.

```js
import { startAveAuth } from "@ave-id/embed";

startAveAuth({
  redirectUri: "https://yourapp.com/callback",
  onSuccess: ({ redirectUrl }) => {
    window.location.assign(redirectUrl);
  },
});
```

If you want tokens directly in the browser, use `onTokens` instead of `onSuccess`.
If you omit `clientId`, `startAveAuth()` automatically uses the Quick Ave format for the current origin.

## How to choose an embed mode

- **`mountAveEmbed`**: permanent inline sign-in area inside your page layout
- **`openAveSheet`**: the best default for mobile/touch UX and app-like flows
- **`openAvePopup`**: best for desktop dashboards and power-user tools
- **connector/signing sheets**: use when you need a delegated permission or signing step without leaving the page

All auth embeds send results back over `postMessage`. On success you usually receive a `redirectUrl` and should navigate the browser there.

## Usage

### Inline iframe

```js
import { mountAveEmbed } from "@ave-id/embed";

const { iframe } = mountAveEmbed({
  container: document.getElementById("ave-embed"),
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
  scope: "openid profile email",
  onSuccess: ({ redirectUrl }) => {
    window.location.href = redirectUrl;
  },
  onError: (payload) => console.error("Embed error", payload),
});
```

### Modal sheet (mobile-friendly)

```js
import { openAveSheet } from "@ave-id/embed";

const sheet = openAveSheet({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
  scope: "openid profile email",
  onSuccess: ({ redirectUrl }) => {
    window.location.href = redirectUrl;
  },
  onError: (payload) => console.error("Sheet error", payload),
  onClose: () => console.log("Sheet closed"),
});

// sheet?.close();
```

This is the lower-level version of `startAveAuth()`. The sheet keeps the user on the current page, works well on mobile, automatically falls back to a popup when a full browser auth step is required, and redirects if the popup is blocked.

### Sheet + server callback route

The simplest production setup is:

1. Open the sheet from your sign-in button
2. Redirect to your app callback on success
3. Exchange the code on your server callback route with `exchangeCodeServer()`

```ts
// sign-in button
import { openAveSheet } from "@ave-id/embed";

openAveSheet({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
  onSuccess: ({ redirectUrl }) => {
    window.location.assign(redirectUrl);
  },
});
```

That flow is ideal for confidential apps that already have a server handling OAuth callbacks.

### Sheet + explicit PKCE

If you want a browser-side public client flow, generate PKCE yourself before opening the sheet and persist the verifier/state/nonce in the browser:

```ts
import { openAveSheet } from "@ave-id/embed";
import { generateCodeChallenge, generateCodeVerifier } from "@ave-id/sdk";

const verifier = generateCodeVerifier();
const challenge = await generateCodeChallenge(verifier);
const state = crypto.randomUUID();
const nonce = crypto.randomUUID();

sessionStorage.setItem("ave_code_verifier", verifier);
sessionStorage.setItem("ave_state", state);
sessionStorage.setItem("ave_nonce", nonce);

openAveSheet({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
  codeChallenge: challenge,
  codeChallengeMethod: "S256",
  extraParams: { state, nonce },
  onSuccess: ({ redirectUrl }) => {
    window.location.assign(redirectUrl);
  },
});
```

`sessionStorage` is a good default for PKCE because it is tab-scoped, but remember it is cleared when the tab/window is closed. If you need longer-lived persistence, store the verifier/state somewhere more durable and weigh the security trade-offs carefully.

On your callback route, parse `code` and `state`, validate the stored state, then call `exchangeCode()` with the stored verifier. If you want the SDK to manage PKCE state/nonce for you automatically, use `startPkceLogin()` / `finishPkceLogin()` directly instead of an embed flow.

### Popup window (desktop)

```js
import { openAvePopup } from "@ave-id/embed";

const popup = openAvePopup({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
  scope: "openid profile email",
  onSuccess: ({ redirectUrl }) => {
    window.location.href = redirectUrl;
  },
  onError: (payload) => console.error("Popup error", payload),
  onClose: () => console.log("Popup closed"),
});

// popup?.close();
```

### Connector flow (separate from sign-in)

```js
import { openAveConnectorSheet } from "@ave-id/embed";

openAveConnectorSheet({
  clientId: "YOUR_CLIENT_ID",
  redirectUri: "https://yourapp.com/callback",
  resource: "target:resource",
  scope: "resource.access",
  mode: "user_present", // or "background"
  onSuccess: ({ redirectUrl }) => {
    window.location.href = redirectUrl;
  },
});
```

Use connector sheets when you need the user to approve access to a downstream resource without sending them away from your current app screen.

### Connector runtime (protected browser execution)

```js
import { openAveConnectorRuntime } from "@ave-id/embed";

const runtime = openAveConnectorRuntime({
  delegatedToken: "DELEGATED_TOKEN",
  target: "iris", // example target app
  targetOrigin: "https://irischat.app",
  mode: "user_present",
  onEvent: (event) => console.log(event),
});

runtime.send({
  op: "infer",
  payload: { prompt: "hello" },
});
```

## Common patterns

### 1) Existing SPA / web app

- if you want a full managed PKCE flow, use `@ave-id/sdk/client`
- if you specifically want a sheet/popup UX, open the embed and manage PKCE or callback exchange yourself

### 2) Server-rendered app

- open a sheet or popup
- redirect to your callback route
- exchange the code on the server with `exchangeCodeServer()`

### 3) Quick prototype

- use `@ave-id/sdk/client` Quick Ave helpers if you do not want app registration
- use `@ave-id/embed` when you specifically want an iframe/sheet/popup UX

## Sheet behavior notes

- `openAveSheet()` renders a bottom sheet overlay and injects an iframe pointed at `https://aveid.net/signin`
- if Ave needs a top-level browser context, the sheet will request a popup automatically
- `onClose()` fires when the user dismisses the sheet
- `onError()` fires for protocol/auth errors, popup blocking, or explicit Ave-side failures
- `onSuccess()` fires with a payload containing `redirectUrl`

## Security notes

- for registered apps, use PKCE (`S256`) whenever possible
- if you are handling returned tokens in the browser, verify them with `@ave-id/sdk`
- keep your `redirectUri` exact and stable across your auth and callback code
- the default `issuer` is `https://aveid.net`

## Options

Common:

- `clientId` (string)
- `redirectUri` (string)
- `scope` (string, default `openid profile email`)
- `issuer` (string, default `https://aveid.net`)
- `onSuccess(payload)`
- `onError(payload)`
- `onClose()`

`mountAveEmbed`:

- `container` (HTMLElement)
- `theme` (string)
- `width` (string | number)
- `height` (string | number)

`openAveSheet`:

- `theme` (string)
- `codeChallenge` (string)
- `codeChallengeMethod` (`"S256"` or `"plain"`, use `"S256"`)
- `extraParams` (`Record<string, string>`)

`openAvePopup`:

- `width` (number)
- `height` (number)
