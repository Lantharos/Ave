import { resolve } from "$app/paths";

function resolveInternalPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") ? resolve(path as any) : path;
}

export function safeGoto(gotoFn: (path: string) => void, path: string) {
  const now = Date.now();
  const last = safeGoto.lastNavAt ?? 0;
  if (now - last < 500) return;
  safeGoto.lastNavAt = now;

  try {
    const target = new URL(path, window.location.href);
    if (target.origin !== window.location.origin) {
      window.location.assign(target.toString());
      return;
    }
  } catch {
  }

  try {
    gotoFn(resolveInternalPath(path));
  } catch {
    try {
      window.location.assign(path);
    } catch {
    }
  }
}

safeGoto.lastNavAt = 0 as number;
