import { normalizeScopeToken } from "./oauth-scopes";

export const E2EE_SCOPES = {
  SYMMETRIC: "e2ee:symmetric",
  ASYMMETRIC: "e2ee:asymmetric",
  PQC_KYBER: "e2ee:pqc:kyber",
  PQC_DILITHIUM: "e2ee:pqc:dilithium",
} as const;

export const E2EE_RESET_SCOPE = "e2ee:reset" as const;

export const E2EE_SCOPE_VALUES = Object.values(E2EE_SCOPES);

export type E2eeMode = "symmetric" | "asymmetric" | "pqc_kyber" | "pqc_dilithium";

export type E2eeScope = (typeof E2EE_SCOPES)[keyof typeof E2EE_SCOPES];

const IMPLEMENTED_E2EE_MODES = new Set<E2eeMode>(["symmetric", "asymmetric"]);

export function isE2eeResetScope(scope: string): boolean {
  return normalizeScopeToken(scope) === E2EE_RESET_SCOPE;
}

export function isE2eeModeScope(scope: string): boolean {
  return (E2EE_SCOPE_VALUES as readonly string[]).includes(normalizeScopeToken(scope));
}

export function isE2eeScope(scope: string): boolean {
  return isE2eeModeScope(scope) || isE2eeResetScope(scope);
}

export function hasAnyE2eeScope(scopes: string[] | null | undefined): boolean {
  return (scopes ?? []).some(isE2eeScope);
}

export function hasE2eeResetScope(scopes: string[] | null | undefined): boolean {
  return (scopes ?? []).some(isE2eeResetScope);
}

export function syncSupportsE2eeFlag(supportsE2ee: boolean | undefined): boolean {
  return !!supportsE2ee;
}

export function appEffectiveSupportsE2ee(app: {
  supportsE2ee?: boolean | null;
  allowedScopes?: string[] | null;
}): boolean {
  return !!app.supportsE2ee || hasAnyE2eeScope(app.allowedScopes);
}

export function e2eeModeForScope(scope: E2eeScope): E2eeMode {
  switch (scope) {
    case E2EE_SCOPES.SYMMETRIC:
      return "symmetric";
    case E2EE_SCOPES.ASYMMETRIC:
      return "asymmetric";
    case E2EE_SCOPES.PQC_KYBER:
      return "pqc_kyber";
    case E2EE_SCOPES.PQC_DILITHIUM:
      return "pqc_dilithium";
    default:
      return "symmetric";
  }
}

export function isImplementedE2eeMode(mode: E2eeMode): boolean {
  return IMPLEMENTED_E2EE_MODES.has(mode);
}

export function storedModeToE2eeMode(
  stored: string | null | undefined,
): E2eeMode | null {
  if (stored === "symmetric" || stored === "asymmetric") return stored;
  if (stored === "pqc_kyber" || stored === "pqc_dilithium") return stored;
  return null;
}

export const USER_ID_SCOPE = "user_id" as const;

export function isUserIdScope(scope: string): boolean {
  return normalizeScopeToken(scope) === USER_ID_SCOPE;
}

export function isDynamicOAuthScope(scope: string): boolean {
  return isE2eeScope(scope) || isUserIdScope(scope);
}

/** E2EE and user_id scopes are chosen per OAuth request, not pre-configured on the app. */
export function isScopeAllowedForApp(
  scope: string,
  allowedScopes: string[],
): boolean {
  if (isDynamicOAuthScope(scope)) {
    return true;
  }
  return allowedScopes.includes(normalizeScopeToken(scope));
}

export function stripE2eeScopes(scopes: string[]): string[] {
  return scopes
    .map(normalizeScopeToken)
    .filter((scope) => !isE2eeScope(scope) && !isUserIdScope(scope));
}

function collectRequestedE2eeModes(
  requestedScopes: string[],
  app: { supportsE2ee?: boolean | null; allowedScopes?: string[] | null },
): E2eeMode[] {
  const legacySymmetric =
    !!app.supportsE2ee && !hasAnyE2eeScope(app.allowedScopes);

  const matched: E2eeMode[] = [];
  for (const scope of requestedScopes) {
    if (!isE2eeModeScope(scope)) continue;
    matched.push(e2eeModeForScope(normalizeScopeToken(scope) as E2eeScope));
  }

  if (legacySymmetric && !requestedScopes.some(isE2eeModeScope)) {
    matched.push("symmetric");
  }

  return matched;
}

export type E2eeAuthorizationResolution = {
  mode: E2eeMode | null;
  conflict: boolean;
  reset: boolean;
};

export function resolveE2eeAuthorization(
  requestedScopes: string[],
  app: { supportsE2ee?: boolean | null; allowedScopes?: string[] | null },
  existing?: { appEncryptionMode?: string | null } | null,
): E2eeAuthorizationResolution {
  const reset = hasE2eeResetScope(requestedScopes);
  const matched = collectRequestedE2eeModes(requestedScopes, app);

  let mode: E2eeMode | null = null;
  const unique = [...new Set(matched)];
  if (unique.length > 1) {
    return { mode: null, conflict: true, reset };
  }
  mode = unique[0] ?? null;

  if (reset && !mode && existing?.appEncryptionMode) {
    mode = storedModeToE2eeMode(existing.appEncryptionMode);
  }

  return { mode, conflict: false, reset };
}

/**
 * Resolve which E2EE mode applies for this authorization.
 * Legacy apps with supports_e2ee and no e2ee:* scopes default to symmetric.
 */
export function resolveRequestedE2eeMode(
  requestedScopes: string[],
  app: { supportsE2ee?: boolean | null; allowedScopes?: string[] | null },
): E2eeMode | null {
  return resolveE2eeAuthorization(requestedScopes, app).mode;
}

export function resolveRequestedE2eeModeConflict(
  requestedScopes: string[],
  app: { supportsE2ee?: boolean | null; allowedScopes?: string[] | null },
  existing?: { appEncryptionMode?: string | null } | null,
): { mode: E2eeMode | null; conflict: boolean; reset: boolean } {
  return resolveE2eeAuthorization(requestedScopes, app, existing);
}

export const PORTAL_APP_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;

export const STANDARD_OAUTH_SCOPES = [
  ...PORTAL_APP_SCOPES,
  USER_ID_SCOPE,
] as const;
