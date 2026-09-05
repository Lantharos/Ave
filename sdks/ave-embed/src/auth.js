import { attachFrameFlow, createFrame, createPopupFlow, createSheetFlow, DEFAULT_ISSUER, flowUrl, openWindow, popupBlocked } from "./browser.js";

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function randomValue() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

function hasNonce(token, nonce) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.nonce === nonce;
  } catch {
    return false;
  }
}

function mergeEncryptionKeys(url, tokens) {
  const params = new URLSearchParams(url.hash.slice(1));
  for (const key of ["app_key", "app_key_old", "app_public_key", "app_public_key_old", "app_private_key", "app_private_key_old"]) {
    const value = params.get(key);
    if (value) tokens[key] = value.replace(/ /g, "+");
  }
  if (["true", "1"].includes(params.get("app_key_reset"))) tokens.app_key_reset = true;
  return tokens;
}

async function prepareAuth({ clientId, redirectUri, scope = "openid profile email", issuer = DEFAULT_ISSUER, theme = "dark", codeChallenge, codeChallengeMethod, extraParams = {}, onTokens, onSuccess, onError, onClose }) {
  const params = { ...extraParams, client_id: clientId, redirect_uri: redirectUri, scope, theme };
  let verifier;
  let nonce;
  let state;
  if (onTokens) {
    verifier = randomValue();
    nonce = randomValue();
    state = randomValue();
    codeChallenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    codeChallengeMethod = "S256";
    params.nonce = nonce;
    params.state = state;
  }
  if (codeChallenge) params.code_challenge = codeChallenge;
  if (codeChallengeMethod) params.code_challenge_method = codeChallengeMethod;

  const complete = async (payload) => {
    let tokens;
    try {
      const url = new URL(payload.redirectUrl);
      const callback = new URL(redirectUri);
      if (url.origin !== callback.origin || url.pathname !== callback.pathname || url.username || url.password) throw new Error("invalid_callback");
      const code = url.searchParams.get("code");
      if (!code) throw new Error("missing_code");
      if (url.searchParams.get("state") !== state) throw new Error("state_mismatch");
      const apiOrigin = new URL(issuer).origin === DEFAULT_ISSUER ? "https://api.aveid.net" : issuer;
      const response = await fetch(new URL("/api/oauth/token", apiOrigin), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantType: "authorization_code", code, redirectUri, clientId, codeVerifier: verifier }),
      });
      tokens = await response.json();
      if (!response.ok) throw new Error(tokens.error || "token_exchange_failed");
      if (tokens.id_token && !hasNonce(tokens.id_token, nonce)) throw new Error("nonce_mismatch");
      tokens = mergeEncryptionKeys(url, tokens);
    } catch (error) {
      onError?.({ error: error.message || "token_exchange_failed", message: error.message });
      return;
    }
    onTokens(tokens);
  };

  return {
    url: flowUrl(issuer, "/signin", params),
    issuer,
    handlers: { "ave:success": onTokens ? complete : onSuccess, "ave:error": onError },
    onError,
    onClose,
    redirectOnPopupBlocked: !onTokens,
  };
}

export async function mountAveEmbed(options) {
  if (!options.container) throw new Error("container is required");
  const auth = await prepareAuth(options);
  const iframe = createFrame(auth.url, options);
  const flow = attachFrameFlow({ ...auth, iframe, dispose: () => {} });
  options.container.appendChild(iframe);
  return {
    iframe,
    destroy() {
      flow.finish();
      iframe.remove();
    },
    postMessage(payload) {
      iframe.contentWindow?.postMessage(payload, new URL(auth.issuer).origin);
    },
  };
}

export async function openAveSheet(options) {
  return createSheetFlow(await prepareAuth(options));
}

export async function openAvePopup(options) {
  const popup = openWindow("about:blank", options.width, options.height);
  if (!popup) {
    options.onError?.(popupBlocked);
    return null;
  }
  try {
    const auth = await prepareAuth(options);
    if (popup.closed) {
      options.onClose?.();
      return null;
    }
    return createPopupFlow({ ...auth, popup });
  } catch (error) {
    popup.close();
    throw error;
  }
}

export async function startAveAuth(options) {
  const normalized = { ...options, clientId: options.clientId ?? `origin:${new URL(options.redirectUri).origin}` };
  return options.container ? mountAveEmbed(normalized) : openAveSheet(normalized);
}
