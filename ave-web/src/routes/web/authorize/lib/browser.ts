import { openEmbedPopup, postToEmbedParent } from "$lib/surfaces/web/util/embed-popup";
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
  const redirectUri = new URL(window.location.href).searchParams.get("redirect_uri") ?? "";
  return openEmbedPopup(postMessageTargetOriginFromRedirectUri(redirectUri), 450, 650);
}

export function fallbackToTopLevelAuthorize(): void {
  if (window.parent !== window) {
    const redirectUri = new URL(window.location.href).searchParams.get("redirect_uri") ?? "";
    postToEmbedHost(redirectUri, { type: "ave:auth_required" });
    return;
  }
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
  postToEmbedParent(payload, postMessageTargetOriginFromRedirectUri(redirectUri));
}
