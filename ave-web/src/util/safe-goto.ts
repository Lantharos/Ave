export function safeGoto(gotoFn: (path: string) => void, path: string) {
  const now = Date.now();
  const last = safeGoto.lastNavAt ?? 0;
  if (now - last < 500) return;
  safeGoto.lastNavAt = now;

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
