let navigationRevision = 0;
let pendingDestination: string | null = null;

export function safeGoto(gotoFn: (path: string) => void | Promise<void>, path: string) {
  if (!path || path !== path.trim() || /[\\\u0000-\u001f\u007f]/.test(path)) return;

  let target: URL;
  try {
    target = new URL(path, window.location.href);
  } catch {
    return;
  }
  if (!/^https?:$/.test(target.protocol) || target.username || target.password) return;

  if (target.origin !== window.location.origin || target.pathname.startsWith("//")) {
    navigationRevision++;
    pendingDestination = null;
    window.location.assign(target.href);
    return;
  }

  const destination = `${target.pathname}${target.search}${target.hash}`;
  if (pendingDestination === destination) return;
  const revision = ++navigationRevision;
  pendingDestination = destination;
  const recover = () => {
    if (revision !== navigationRevision) return;
    pendingDestination = null;
    window.location.assign(destination);
  };
  try {
    Promise.resolve(gotoFn(destination)).then(() => {
      if (revision === navigationRevision) pendingDestination = null;
    }, recover);
  } catch {
    recover();
  }
}
