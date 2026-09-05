import { createFrame, DEFAULT_ISSUER } from "./browser.js";

export function openAveConnectorRuntime({ issuer = DEFAULT_ISSUER, target = "resource", targetOrigin, delegatedToken, mode = "user_present", width = "100%", height = 640, container, onReady, onEvent, onError }) {
  const url = new URL("/connect/runtime", issuer);
  url.searchParams.set("target", target);
  url.searchParams.set("mode", mode);
  const origin = url.origin;
  const iframe = createFrame(url.href, { width, height, radius: 18 });
  const sendInit = () => {
    iframe.contentWindow?.postMessage({
      type: "ave:connector:init",
      payload: { delegatedToken, targetOrigin },
    }, origin);
  };
  const messageHandler = (event) => {
    if (event.origin !== origin || event.source !== iframe.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "ave:connector:ready") onReady?.();
    if (data.type === "ave:connector:event") onEvent?.(data.payload);
    if (data.type === "ave:connector:error") onError?.(data.payload);
  };
  iframe.addEventListener("load", sendInit);
  window.addEventListener("message", messageHandler);
  (container || document.body).appendChild(iframe);
  return {
    iframe,
    send(payload) {
      iframe.contentWindow?.postMessage({ type: "ave:connector:request", payload }, origin);
    },
    destroy() {
      window.removeEventListener("message", messageHandler);
      iframe.removeEventListener("load", sendInit);
      iframe.remove();
    },
  };
}

export function openIrisDelegatedRuntime({ targetOrigin = "https://irischat.app", ...rest }) {
  return openAveConnectorRuntime({ target: "iris", targetOrigin, ...rest });
}
