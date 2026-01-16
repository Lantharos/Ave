const DEFAULT_THEME = "dark";

export function mountAveEmbed({
  container,
  clientId,
  redirectUri,
  scope = "openid profile email",
  issuer = "https://aveid.net",
  theme = DEFAULT_THEME,
  width = "100%",
  height = 720,
  onSuccess,
  onError,
  onClose,
}) {
  if (!container) {
    throw new Error("container is required");
  }

  const iframe = document.createElement("iframe");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    embed: "1",
    theme,
  });

  iframe.src = `${issuer}/signin?${params.toString()}`;
  iframe.style.width = width;
  iframe.style.height = typeof height === "number" ? `${height}px` : height;
  iframe.style.border = "0";
  iframe.style.borderRadius = "24px";
  iframe.style.background = "#090909";
  iframe.allow = "publickey-credentials-get";

  container.appendChild(iframe);

  const messageHandler = (event) => {
    if (event.origin !== issuer) return;
    const data = event.data || {};

    if (data.type === "ave:success") {
      onSuccess?.(data.payload);
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
