import type { Reroute } from "@sveltejs/kit";

const surfaces = new Set(["web", "devs", "business"]);

function hasSurfacePrefix(pathname: string) {
  const first = pathname.split("/").filter(Boolean)[0];
  return first ? surfaces.has(first) : false;
}

function surfacePath(surface: "web" | "devs" | "business", pathname: string) {
  if (hasSurfacePrefix(pathname)) return pathname;
  return pathname === "/" ? `/${surface}` : `/${surface}${pathname}`;
}

export const reroute: Reroute = ({ url }) => {
  const host = url.hostname.toLowerCase();

  if (host === "devs.aveid.net") return surfacePath("devs", url.pathname);
  if (host === "business.aveid.net") return surfacePath("business", url.pathname);
  if (host === "aveid.net" || host === "www.aveid.net") return surfacePath("web", url.pathname);

  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    return hasSurfacePrefix(url.pathname) ? url.pathname : surfacePath("web", url.pathname);
  }
};
