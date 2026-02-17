# @ave-id/embed

Lightweight iframe embed for Ave sign-in with postMessage callbacks.

## Install

```bash
npm install @ave-id/embed
```

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

`openAvePopup`:

- `width` (number)
- `height` (number)
