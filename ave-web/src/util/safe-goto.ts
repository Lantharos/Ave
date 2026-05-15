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
    gotoFn(path);
  } catch {
    try {
      window.location.assign(path);
    } catch {
      // Ignore navigation errors
    }
  }
}

safeGoto.lastNavAt = 0 as number;
