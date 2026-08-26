import { postMessageTargetOriginFromRedirectUri } from "$lib/surfaces/web/util/embed-post-message-origin";

type AveIdentityProvider = {
  resolve(assertion: string): void;
  close(): void;
};

export function identityProvider(): AveIdentityProvider | null {
  const provider = (window as Window & { IdentityProvider?: AveIdentityProvider }).IdentityProvider;
  return provider || null;
}

export function openAuthPopupHere(): boolean {
  const width = 450;
  const height = 650;
  const left = (window.innerWidth - width) / 2 + window.screenX;
  const top = (window.innerHeight - height) / 2 + window.screenY;
  const popup = window.open(
    window.location.href,
    "ave_auth",
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
  );
  popup?.focus?.();
  return !!popup;
}

export function fallbackToTopLevelAuthorize(): void {
  const fallbackUrl = new URL(window.location.href);
  fallbackUrl.searchParams.delete("embed");
  window.location.assign(fallbackUrl.toString());
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = window.setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

export function isCustomSchemeRedirect(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol !== "http:" && protocol !== "https:";
  } catch {
    return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url) && !url.startsWith("http://") && !url.startsWith("https://");
  }
}

export function postToEmbedHost(redirectUri: string, payload: unknown): void {
  const opener = window.opener as Window | null;
  const target = opener?.parent ?? window.parent;
  const origin = postMessageTargetOriginFromRedirectUri(redirectUri);
  target?.postMessage(payload, origin);
}
