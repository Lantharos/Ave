export { resolveApiBase, resolveAveOrigin } from "$lib/infrastructure/http/origins";

export function businessReturnTarget() {
  if (typeof window === "undefined") return "https://business.aveid.net";
  return window.location.href;
}
