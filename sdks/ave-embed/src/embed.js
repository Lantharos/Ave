const DEFAULT_THEME = "dark";

// ============================================
// Internal PKCE & token exchange helpers
// ============================================

async function _generateVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function _generateChallenge(verifier) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function _generateNonce() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function _getApiBase(issuer) {
  return (issuer ?? "https://aveid.net").replace("https://aveid.net", "https://api.aveid.net");
}

async function _exchangeCode({ clientId, redirectUri, issuer, code, codeVerifier }) {
  const res = await fetch(`${_getApiBase(issuer)}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grantType: "authorization_code", code, redirectUri, clientId, codeVerifier }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "token_exchange_failed");
  }
  return res.json();
}

// Lightweight nonce check — decodes payload without signature verification.
// Pass the token to verifyJwt from @ave-id/sdk for full cryptographic validation.
function _checkNonce(token, expectedNonce) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.nonce === expectedNonce;
  } catch {
    return false;
  }
}

/**
 * Mount Ave auth embed as an inline iframe
 */
export async function mountAveEmbed({
  container,
  clientId,
  redirectUri,
  scope = "openid profile email",
  issuer = "https://aveid.net",
  theme = DEFAULT_THEME,
  width = "100%",
  height = 720,
  onTokens,
  onSuccess,
  onError,
  onClose,
}) {
  if (!container) {
    throw new Error("container is required");
  }

  let verifier, nonce;
  if (onTokens) {
    verifier = await _generateVerifier();
    nonce = _generateNonce();
  }

  const iframe = document.createElement("iframe");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    embed: "1",
    theme,
  });

  if (verifier) {
    const challenge = await _generateChallenge(verifier);
    params.set("code_challenge", challenge);
    params.set("code_challenge_method", "S256");
    params.set("nonce", nonce);
  }

  iframe.src = `${issuer}/signin?${params.toString()}`;
  iframe.style.width = width;
  iframe.style.height = typeof height === "number" ? `${height}px` : height;
  iframe.style.border = "0";
  iframe.style.borderRadius = "24px";
  iframe.style.background = "#090909";
  iframe.allow = "publickey-credentials-get";

  container.appendChild(iframe);

  const messageHandler = async (event) => {
    if (event.origin !== issuer) return;
    const data = event.data || {};

    if (data.type === "ave:success") {
      if (onTokens) {
        try {
          const code = new URL(data.payload.redirectUrl).searchParams.get("code");
          const tokens = await _exchangeCode({ clientId, redirectUri, issuer, code, codeVerifier: verifier });
          if (tokens.id_token && !_checkNonce(tokens.id_token, nonce)) {
            onError?.({ error: "nonce_mismatch", message: "id_token nonce mismatch — possible replay attack" });
            return;
          }
          onTokens(tokens);
        } catch (err) {
          onError?.({ error: err.message ?? "token_exchange_failed", message: err.message });
        }
      } else {
        onSuccess?.(data.payload);
      }
    }

    if (data.type === "ave:error") {
      onError?.(data.payload);
    }

    if (data.type === "ave:close") {
      onClose?.();
    }
  };

  window.addEventListener("message", messageHandler);

  return {
    iframe,
    destroy() {
      window.removeEventListener("message", messageHandler);
      iframe.remove();
    },
    postMessage(payload) {
      iframe.contentWindow?.postMessage(payload, issuer);
    },
  };
}

/**
 * Open Ave auth as a modal sheet overlay
 */
export async function openAveSheet({
  clientId,
  redirectUri,
  scope = "openid profile email",
  issuer = "https://aveid.net",
  theme = DEFAULT_THEME,
  codeChallenge,
  codeChallengeMethod,
  extraParams = {},
  onTokens,
  onSuccess,
  onError,
  onClose,
}) {
  let resolved = false;
  let popup = null;

  // Auto-generate PKCE when onTokens is used
  let autoVerifier, autoNonce;
  if (onTokens) {
    autoVerifier = await _generateVerifier();
    autoNonce = _generateNonce();
    codeChallenge = await _generateChallenge(autoVerifier);
    codeChallengeMethod = "S256";
  }

  // Create overlay backdrop
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 999999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: aveSheetFadeIn 0.2s ease-out;
  `;

  // Create sheet container
  const sheet = document.createElement("div");
  sheet.style.cssText = `
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    background: #090909;
    border-radius: 24px 24px 0 0;
    overflow: hidden;
    animation: aveSheetSlideUp 0.3s ease-out;
    position: relative;
  `;

  // Add drag handle
  const dragHandle = document.createElement("div");
  dragHandle.style.cssText = `
    width: 40px;
    height: 4px;
    background: #333;
    border-radius: 2px;
    margin: 12px auto;
  `;
  sheet.appendChild(dragHandle);

  // Create close button
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  `;
  closeBtn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 12px;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 8px;
    z-index: 10;
  `;

  // Create iframe
  const iframe = document.createElement("iframe");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    embed: "1",
    theme,
    ...extraParams,
  });
  
  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
  }
  if (codeChallengeMethod) {
    params.set("code_challenge_method", codeChallengeMethod);
  }
  if (autoNonce) {
    params.set("nonce", autoNonce);
  }

  iframe.src = `${issuer}/signin?${params.toString()}`;
  iframe.style.cssText = `
    width: 100%;
    height: calc(90vh - 50px);
    border: none;
    background: #090909;
  `;
  iframe.allow = "publickey-credentials-get";

  sheet.appendChild(closeBtn);
  sheet.appendChild(iframe);
  overlay.appendChild(sheet);

  // Add animations
  const style = document.createElement("style");
  style.textContent = `
    @keyframes aveSheetFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes aveSheetSlideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    @keyframes aveSheetSlideDown {
      from { transform: translateY(0); }
      to { transform: translateY(100%); }
    }
    @keyframes aveSheetFadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // Close function
  const close = () => {
    if (popup && !popup.closed) {
      popup.close();
    }
    sheet.style.animation = "aveSheetSlideDown 0.2s ease-in forwards";
    overlay.style.animation = "aveSheetFadeOut 0.2s ease-in forwards";
    setTimeout(() => {
      overlay.remove();
      style.remove();
      window.removeEventListener("message", messageHandler);
      onClose?.();
    }, 200);
  };

  // Event handlers
  closeBtn.onclick = close;
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };

  const messageHandler = async (event) => {
    if (event.origin !== issuer) return;
    const data = event.data || {};

    if (resolved) return;

    if (data.type === "ave:auth_required") {
      if (!popup || popup.closed) {
        const width = 450;
        const height = 650;
        const left = (window.innerWidth - width) / 2 + window.screenX;
        const top = (window.innerHeight - height) / 2 + window.screenY;
        popup = window.open(
          iframe.src,
          "ave_auth",
          `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
        );
      }
      popup?.focus?.();
      return;
    }

    if (data.type === "ave:success") {
      resolved = true;
      close();
      if (onTokens) {
        try {
          const code = new URL(data.payload.redirectUrl).searchParams.get("code");
          const tokens = await _exchangeCode({ clientId, redirectUri, issuer, code, codeVerifier: autoVerifier });
          if (tokens.id_token && !_checkNonce(tokens.id_token, autoNonce)) {
            onError?.({ error: "nonce_mismatch", message: "id_token nonce mismatch — possible replay attack" });
            return;
          }
          onTokens(tokens);
        } catch (err) {
          onError?.({ error: err.message ?? "token_exchange_failed", message: err.message });
        }
      } else {
        onSuccess?.(data.payload);
      }
    }

    if (data.type === "ave:error") {
      resolved = true;
      close();
      onError?.(data.payload);
    }

    if (data.type === "ave:close") {
      resolved = true;
      close();
    }
  };

  window.addEventListener("message", messageHandler);

  // Add to DOM
  document.body.appendChild(overlay);

  return {
    close,
    iframe,
  };
}

/**
 * Open Ave auth as a popup window (for desktop)
 */
export async function openAvePopup({
  clientId,
  redirectUri,
  scope = "openid profile email",
  issuer = "https://aveid.net",
  theme = DEFAULT_THEME,
  codeChallenge,
  codeChallengeMethod,
  width = 450,
  height = 650,
  onTokens,
  onSuccess,
  onError,
  onClose,
}) {
  // Auto-generate PKCE when onTokens is used
  let autoVerifier, autoNonce;
  if (onTokens) {
    autoVerifier = await _generateVerifier();
    autoNonce = _generateNonce();
    codeChallenge = await _generateChallenge(autoVerifier);
    codeChallengeMethod = "S256";
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    embed: "1",
    theme,
  });
  
  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
  }
  if (codeChallengeMethod) {
    params.set("code_challenge_method", codeChallengeMethod);
  }
  if (autoNonce) {
    params.set("nonce", autoNonce);
  }

  const left = (window.innerWidth - width) / 2 + window.screenX;
  const top = (window.innerHeight - height) / 2 + window.screenY;

  const popup = window.open(
    `${issuer}/signin?${params.toString()}`,
    "ave_auth",
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
  );

  if (!popup) {
    onError?.({ error: "popup_blocked", message: "Popup was blocked by the browser" });
    return null;
  }

  const messageHandler = async (event) => {
    if (event.origin !== issuer) return;
    const data = event.data || {};

    if (data.type === "ave:success") {
      popup.close();
      window.removeEventListener("message", messageHandler);
      if (onTokens) {
        try {
          const code = new URL(data.payload.redirectUrl).searchParams.get("code");
          const tokens = await _exchangeCode({ clientId, redirectUri, issuer, code, codeVerifier: autoVerifier });
          if (tokens.id_token && !_checkNonce(tokens.id_token, autoNonce)) {
            onError?.({ error: "nonce_mismatch", message: "id_token nonce mismatch — possible replay attack" });
            return;
          }
          onTokens(tokens);
        } catch (err) {
          onError?.({ error: err.message ?? "token_exchange_failed", message: err.message });
        }
      } else {
        onSuccess?.(data.payload);
      }
    }

    if (data.type === "ave:error") {
      popup.close();
      window.removeEventListener("message", messageHandler);
      onError?.(data.payload);
    }

    if (data.type === "ave:close") {
      popup.close();
      window.removeEventListener("message", messageHandler);
      onClose?.();
    }
  };

  window.addEventListener("message", messageHandler);

  // Check if popup was closed
  const pollTimer = setInterval(() => {
    if (popup.closed) {
      clearInterval(pollTimer);
      window.removeEventListener("message", messageHandler);
      onClose?.();
    }
  }, 500);

  return {
    popup,
    close() {
      clearInterval(pollTimer);
      popup.close();
      window.removeEventListener("message", messageHandler);
    },
  };
}

/**
 * Open Ave connector flow as a modal sheet.
 */
export function openAveConnectorSheet({
  clientId,
  redirectUri,
  resource,
  scope = "resource.access",
  mode = "user_present",
  issuer = "https://aveid.net",
  onSuccess,
  onError,
  onClose,
}) {
  return openAveSheet({
    clientId,
    redirectUri,
    scope,
    issuer,
    onSuccess,
    onError,
    onClose,
    codeChallenge: undefined,
    codeChallengeMethod: undefined,
    theme: "dark",
    extraParams: {
      resource,
      mode,
    },
  });
}

/**
 * Open Ave connector flow in a popup.
 */
export function openAveConnectorPopup({
  clientId,
  redirectUri,
  resource,
  scope = "resource.access",
  mode = "user_present",
  issuer = "https://aveid.net",
  width = 460,
  height = 700,
  onSuccess,
  onError,
  onClose,
}) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    resource,
    scope,
    mode,
    embed: "1",
  });

  const left = (window.innerWidth - width) / 2 + window.screenX;
  const top = (window.innerHeight - height) / 2 + window.screenY;
  const popup = window.open(
    `${issuer}/connect?${params.toString()}`,
    "ave_connector",
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
  );

  if (!popup) {
    onError?.({ error: "popup_blocked", message: "Popup was blocked by the browser" });
    return null;
  }

  const messageHandler = (event) => {
    if (event.origin !== issuer) return;
    const data = event.data || {};

    if (data.type === "ave:success") {
      popup.close();
      window.removeEventListener("message", messageHandler);
      onSuccess?.(data.payload);
    }
    if (data.type === "ave:error") {
      popup.close();
      window.removeEventListener("message", messageHandler);
      onError?.(data.payload);
    }
    if (data.type === "ave:close") {
      popup.close();
      window.removeEventListener("message", messageHandler);
      onClose?.();
    }
  };

  window.addEventListener("message", messageHandler);

  return {
    popup,
    close() {
      popup.close();
      window.removeEventListener("message", messageHandler);
    },
  };
}

// ============================================
// Ave Signing Embeds
// ============================================

/**
 * Open Ave signing as a modal sheet overlay
 */
export function openAveSigningSheet({
  requestId,
  issuer = "https://aveid.net",
  onSigned,
  onDenied,
  onClose,
}) {
  let resolved = false;
  let popup = null;

  // Create overlay backdrop
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    z-index: 999999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: aveSheetFadeIn 0.2s ease-out;
  `;

  // Create sheet container
  const sheet = document.createElement("div");
  sheet.style.cssText = `
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    background: #111111;
    border-radius: 32px 32px 0 0;
    overflow: hidden;
    animation: aveSheetSlideUp 0.3s ease-out;
    position: relative;
  `;

  // Add drag handle
  const dragHandle = document.createElement("div");
  dragHandle.style.cssText = `
    width: 40px;
    height: 4px;
    background: #333;
    border-radius: 2px;
    margin: 12px auto;
  `;
  sheet.appendChild(dragHandle);

  // Create iframe
  const iframe = document.createElement("iframe");
  const params = new URLSearchParams({
    requestId,
    embed: "1",
  });

  iframe.src = `${issuer}/sign?${params.toString()}`;
  iframe.style.cssText = `
    width: 100%;
    height: calc(90vh - 30px);
    border: none;
    background: transparent;
  `;
  iframe.allow = "publickey-credentials-get";

  sheet.appendChild(iframe);
  overlay.appendChild(sheet);

  // Add animations (reuse if already present)
  if (!document.getElementById("ave-sheet-styles")) {
    const style = document.createElement("style");
    style.id = "ave-sheet-styles";
    style.textContent = `
      @keyframes aveSheetFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes aveSheetSlideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      @keyframes aveSheetSlideDown {
        from { transform: translateY(0); }
        to { transform: translateY(100%); }
      }
      @keyframes aveSheetFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // Close function
  const close = () => {
    if (popup && !popup.closed) {
      popup.close();
    }
    sheet.style.animation = "aveSheetSlideDown 0.2s ease-in forwards";
    overlay.style.animation = "aveSheetFadeOut 0.2s ease-in forwards";
    setTimeout(() => {
      overlay.remove();
      window.removeEventListener("message", messageHandler);
      onClose?.();
    }, 200);
  };

  // Click outside to close
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };

  const messageHandler = (event) => {
    if (event.origin !== issuer) return;
    const data = event.data || {};

    if (resolved) return;

    if (data.type === "ave:auth_required") {
      if (!popup || popup.closed) {
        const width = 500;
        const height = 600;
        const left = (window.innerWidth - width) / 2 + window.screenX;
        const top = (window.innerHeight - height) / 2 + window.screenY;
        popup = window.open(
          iframe.src,
          "ave_signing",
          `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
        );
      }
      popup?.focus?.();
      return;
    }

    if (data.type === "ave:signed") {
      resolved = true;
      close();
      onSigned?.(data.payload);
    }

    if (data.type === "ave:denied") {
      resolved = true;
      close();
      onDenied?.(data.payload);
    }
  };

  window.addEventListener("message", messageHandler);

  // Add to DOM
  document.body.appendChild(overlay);

  return {
    close,
    iframe,
  };
}

/**
 * Open Ave signing as a popup window
 */
export function openAveSigningPopup({
  requestId,
  issuer = "https://aveid.net",
  width = 500,
  height = 600,
  onSigned,
  onDenied,
  onClose,
}) {
  const params = new URLSearchParams({
    requestId,
    embed: "1",
  });

  const left = (window.innerWidth - width) / 2 + window.screenX;
  const top = (window.innerHeight - height) / 2 + window.screenY;

  const popup = window.open(
    `${issuer}/sign?${params.toString()}`,
    "ave_signing",
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
  );

  if (!popup) {
    onDenied?.({ error: "popup_blocked", message: "Popup was blocked by the browser" });
    return null;
  }

  const messageHandler = (event) => {
    if (event.origin !== issuer) return;
    const data = event.data || {};

    if (data.type === "ave:signed") {
      popup.close();
      window.removeEventListener("message", messageHandler);
      onSigned?.(data.payload);
    }

    if (data.type === "ave:denied") {
      popup.close();
      window.removeEventListener("message", messageHandler);
      onDenied?.(data.payload);
    }
  };

  window.addEventListener("message", messageHandler);

  // Check if popup was closed
  const pollTimer = setInterval(() => {
    if (popup.closed) {
      clearInterval(pollTimer);
      window.removeEventListener("message", messageHandler);
      onClose?.();
    }
  }, 500);

  return {
    popup,
    close() {
      clearInterval(pollTimer);
      popup.close();
      window.removeEventListener("message", messageHandler);
    },
  };
}

// ============================================
// Connector Runtime (Target App Execution)
// ============================================

/**
 * Open a connector runtime iframe for protected execution in the user's browser.
 * The host app sends requests via postMessage and receives streaming events.
 */
export function openAveConnectorRuntime({
  issuer = "https://aveid.net",
  target = "resource",
  targetOrigin,
  delegatedToken,
  mode = "user_present",
  width = "100%",
  height = 640,
  container,
  onReady,
  onEvent,
  onError,
}) {
  const runtimeUrl = new URL(`${issuer}/connect/runtime`);
  runtimeUrl.searchParams.set("target", target);
  runtimeUrl.searchParams.set("mode", mode);

  const iframe = document.createElement("iframe");
  iframe.src = runtimeUrl.toString();
  iframe.style.width = width;
  iframe.style.height = typeof height === "number" ? `${height}px` : height;
  iframe.style.border = "0";
  iframe.style.borderRadius = "18px";
  iframe.allow = "publickey-credentials-get";

  const mountTarget = container || document.body;
  mountTarget.appendChild(iframe);

  const sendInit = () => {
    iframe.contentWindow?.postMessage(
      {
        type: "ave:connector:init",
        payload: {
          delegatedToken,
          targetOrigin,
        },
      },
      issuer
    );
  };

  iframe.addEventListener("load", sendInit);

  const messageHandler = (event) => {
    if (event.origin !== issuer) return;
    const data = event.data || {};

    if (data.type === "ave:connector:ready") {
      onReady?.();
      return;
    }

    if (data.type === "ave:connector:event") {
      onEvent?.(data.payload);
      return;
    }

    if (data.type === "ave:connector:error") {
      onError?.(data.payload);
      return;
    }
  };

  window.addEventListener("message", messageHandler);

  return {
    iframe,
    send(payload) {
      iframe.contentWindow?.postMessage(
        { type: "ave:connector:request", payload },
        issuer
      );
    },
    destroy() {
      window.removeEventListener("message", messageHandler);
      iframe.removeEventListener("load", sendInit);
      iframe.remove();
    },
  };
}

/**
 * Backward-compatible wrapper for Iris integrations.
 */
export function openIrisDelegatedRuntime({
  targetOrigin = "https://irischat.app",
  ...rest
}) {
  return openAveConnectorRuntime({
    target: "iris",
    targetOrigin,
    ...rest,
  });
}
