const completionTypes = new Set(["ave:success", "ave:error", "ave:close", "ave:signed", "ave:denied"]);

export function postToEmbedParent(payload: unknown, targetOrigin: string) {
  const relay = new URL(window.location.href).searchParams.get("embed_relay") === "1";
  const target = window.opener ?? window.parent;
  target?.postMessage(payload, window.opener && relay ? window.location.origin : targetOrigin);
}

export function openEmbedPopup(targetOrigin: string, width: number, height: number): boolean {
  const url = new URL(window.location.href);
  url.searchParams.set("embed_relay", "1");
  const left = (window.innerWidth - width) / 2 + window.screenX;
  const top = (window.innerHeight - height) / 2 + window.screenY;
  const popup = window.open(
    url.href,
    "_blank",
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
  );
  if (!popup) return false;

  const stop = () => {
    window.clearInterval(timer);
    window.removeEventListener("message", forward);
  };
  const forward = (event: MessageEvent) => {
    if (event.source !== popup || event.origin !== window.location.origin) return;
    if (!event.data || !completionTypes.has(event.data.type)) return;
    stop();
    postToEmbedParent(event.data, targetOrigin);
  };
  const timer = window.setInterval(() => {
    if (popup.closed) {
      stop();
      postToEmbedParent({ type: "ave:close" }, targetOrigin);
    }
  }, 500);
  window.addEventListener("message", forward);
  popup.focus();
  return true;
}
