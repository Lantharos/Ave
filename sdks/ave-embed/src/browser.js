export const DEFAULT_ISSUER = "https://aveid.net";

export function flowUrl(issuer, path, params) {
  const url = new URL(path, issuer);
  url.search = new URLSearchParams({ ...params, embed: "1" }).toString();
  return url.href;
}

export function openWindow(url, width = 450, height = 650) {
  const left = (window.innerWidth - width) / 2 + window.screenX;
  const top = (window.innerHeight - height) / 2 + window.screenY;
  return window.open(url, "_blank", `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`);
}

export const popupBlocked = {
  error: "popup_blocked",
  message: "Allow popups for this site and try again.",
};

function listenForCompletion({ issuer, sources, handlers, dispose, onClose, onAuthRequired }) {
  const origin = new URL(issuer).origin;
  let finished = false;
  const finish = (callback, payload) => {
    if (finished) return;
    finished = true;
    window.removeEventListener("message", messageHandler);
    dispose();
    callback?.(payload);
  };
  const messageHandler = (event) => {
    if (finished || event.origin !== origin || !event.source || !sources().includes(event.source)) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "ave:auth_required") {
      onAuthRequired?.();
    } else if (data.type === "ave:close") {
      finish(onClose);
    } else if (Object.hasOwn(handlers, data.type)) {
      finish(handlers[data.type], data.payload);
    }
  };
  window.addEventListener("message", messageHandler);
  return { finish, close: () => finish(onClose) };
}

export function createFrame(url, { width = "100%", height = 720, radius = 24 } = {}) {
  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.title = "Ave";
  iframe.style.width = typeof width === "number" ? `${width}px` : width;
  iframe.style.height = typeof height === "number" ? `${height}px` : height;
  iframe.style.border = "0";
  iframe.style.borderRadius = `${radius}px`;
  iframe.style.background = "#090909";
  iframe.allow = "publickey-credentials-get";
  return iframe;
}

export function attachFrameFlow({ iframe, issuer, handlers, dispose, onClose, onError, redirectOnPopupBlocked = false }) {
  let popup = null;
  let pollTimer;
  const stopPopup = () => {
    clearInterval(pollTimer);
    if (popup && !popup.closed) popup.close();
  };
  const flow = listenForCompletion({
    issuer,
    sources: () => [iframe.contentWindow, popup],
    handlers,
    onClose,
    dispose: () => {
      stopPopup();
      dispose();
    },
    onAuthRequired: () => {
      if (!popup || popup.closed) {
        popup = openWindow(iframe.src);
        if (!popup) {
          flow.finish(redirectOnPopupBlocked ? () => {
            const url = new URL(iframe.src);
            url.searchParams.delete("embed");
            window.location.assign(url.href);
          } : onError, popupBlocked);
          return;
        }
        pollTimer = setInterval(() => {
          if (popup.closed) flow.close();
        }, 500);
      }
      popup.focus();
    },
  });
  return flow;
}

export function createPopupFlow({ url, issuer, handlers, onError, onClose, width, height, popup = openWindow(url, width, height) }) {
  if (!popup) {
    onError?.(popupBlocked);
    return null;
  }
  let pollTimer;
  const flow = listenForCompletion({
    issuer,
    sources: () => [popup],
    handlers,
    onClose,
    dispose: () => {
      clearInterval(pollTimer);
      if (!popup.closed) popup.close();
    },
  });
  pollTimer = setInterval(() => {
    if (popup.closed) flow.close();
  }, 500);
  popup.location.href = url;
  return { popup, close: flow.close };
}

export function createSheetFlow({ url, signing = false, ...options }) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0, 0, 0, ${signing ? "0.8" : "0.7"});
    backdrop-filter: blur(4px); z-index: 999999; display: flex; align-items: flex-end;
    justify-content: center; animation: aveSheetFadeIn 0.2s ease-out;
  `;
  const sheet = document.createElement("div");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", signing ? "Ave signing" : "Ave sign-in");
  sheet.style.cssText = `
    width: 100%; max-width: ${signing ? "600" : "500"}px; max-height: 90vh;
    background: ${signing ? "#111111" : "#090909"}; border-radius: ${signing ? "32" : "24"}px ${signing ? "32" : "24"}px 0 0;
    overflow: hidden; animation: aveSheetSlideUp 0.3s ease-out; position: relative;
  `;
  const handle = document.createElement("div");
  handle.style.cssText = "width:40px;height:4px;background:#333;border-radius:2px;margin:12px auto;";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  closeButton.style.cssText = "position:absolute;top:8px;right:12px;background:transparent;border:none;cursor:pointer;padding:8px;z-index:10;";
  const iframe = createFrame(url, { height: "calc(90vh - 50px)", radius: 0 });
  const style = document.createElement("style");
  style.textContent = `
    @keyframes aveSheetFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes aveSheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes aveSheetSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
    @keyframes aveSheetFadeOut { from { opacity: 1; } to { opacity: 0; } }
  `;
  const flow = attachFrameFlow({
    ...options,
    iframe,
    dispose: () => {
      sheet.style.animation = "aveSheetSlideDown 0.2s ease-in forwards";
      overlay.style.animation = "aveSheetFadeOut 0.2s ease-in forwards";
      setTimeout(() => {
        overlay.remove();
        style.remove();
      }, 200);
    },
  });
  closeButton.onclick = flow.close;
  overlay.onclick = (event) => {
    if (event.target === overlay) flow.close();
  };
  sheet.append(handle, closeButton, iframe);
  overlay.appendChild(sheet);
  document.head.appendChild(style);
  document.body.appendChild(overlay);
  return { iframe, close: flow.close };
}
