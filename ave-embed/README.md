# @ave-id/embed

Lightweight iframe embed for Ave sign-in with postMessage callbacks.

## Install

```bash
npm install @ave-id/embed
```

## Usage

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
