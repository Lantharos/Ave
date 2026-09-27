export function normalizeScopeToken(scope: string): string {
  let value = scope.trim();
  if (!value) return value;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (!/%[0-9A-Fa-f]{2}/.test(value)) break;
    try {
      const decoded = decodeURIComponent(value.replace(/\+/g, " "));
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }

  return value;
}

export function parseOAuthScopes(scope: string): string[] {
  return scope
    .replace(/\+/g, " ")
    .split(/\s+/)
    .map(normalizeScopeToken)
    .filter(Boolean);
}

export function joinOAuthScopes(scopes: string[]): string {
  return scopes.map(normalizeScopeToken).filter(Boolean).join(" ");
}
