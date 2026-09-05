let sessionFingerprint: string | undefined;

function getDeviceFingerprint(): string {
  if (sessionFingerprint) return sessionFingerprint;
  const storageKey = "ave_device_fingerprint";
  try {
    sessionFingerprint = localStorage.getItem(storageKey) || crypto.randomUUID();
    localStorage.setItem(storageKey, sessionFingerprint);
  } catch {
    sessionFingerprint = crypto.randomUUID();
  }
  return sessionFingerprint;
}

export function getDeviceInfo(): {
  name: string;
  type: "phone" | "computer" | "tablet";
  browser: string;
  os: string;
  fingerprint: string;
} {
  const ua = navigator.userAgent;
  const browser = /Edg|EdgiOS|EdgA/.test(ua) ? "Edge"
    : /Opera|OPR\//.test(ua) ? "Opera"
    : /Firefox|FxiOS/.test(ua) ? "Firefox"
    : /Chrome|CriOS/.test(ua) ? "Chrome"
    : ua.includes("Safari") ? "Safari"
    : "Unknown Browser";
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : ua.includes("Android") ? "Android"
    : ua.includes("Windows") ? "Windows"
    : ua.includes("Mac OS") ? "macOS"
    : ua.includes("Linux") ? "Linux"
    : "Unknown OS";
  const type = /Tablet|iPad/i.test(ua) || (ua.includes("Android") && !ua.includes("Mobile")) ? "tablet"
    : /Mobi|iPhone|iPod/i.test(ua) ? "phone"
    : "computer";

  return { name: `${browser} on ${os}`, type, browser, os, fingerprint: getDeviceFingerprint() };
}
