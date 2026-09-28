import { normalizeScopeToken } from "./scopes";

const E2EE_SCOPES = {
  SYMMETRIC: "e2ee:symmetric",
  ASYMMETRIC: "e2ee:asymmetric",
  PQC_KYBER: "e2ee:pqc:kyber",
  PQC_DILITHIUM: "e2ee:pqc:dilithium",
} as const;

const E2EE_RESET_SCOPE = "e2ee:reset" as const;

const E2EE_SCOPE_VALUES = Object.values(E2EE_SCOPES);

export type E2eeMode = "symmetric" | "asymmetric" | "pqc_kyber" | "pqc_dilithium";

type E2eeScope = (typeof E2EE_SCOPES)[keyof typeof E2EE_SCOPES];

function isE2eeResetScope(scope: string): boolean {
  return normalizeScopeToken(scope) === E2EE_RESET_SCOPE;
}

function isE2eeModeScope(scope: string): boolean {
  return (E2EE_SCOPE_VALUES as readonly string[]).includes(normalizeScopeToken(scope));
}

function isE2eeScope(scope: string): boolean {
  return isE2eeModeScope(scope) || isE2eeResetScope(scope);
}

function hasAnyE2eeScope(scopes: string[] | null | undefined): boolean {
  return (scopes ?? []).some(isE2eeScope);
}

export function hasE2eeResetScope(scopes: string[] | null | undefined): boolean {
  return (scopes ?? []).some(isE2eeResetScope);
}

export function hasUserIdScope(scopes: string[] | null | undefined): boolean {
  return (scopes ?? []).some((scope) => normalizeScopeToken(scope) === "user_id");
}

export function authorizeFlowShowsE2ee(requestedScopes: string[]): boolean {
  return hasAnyE2eeScope(requestedScopes);
}

function e2eeModeForScope(scope: E2eeScope): E2eeMode {
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

function storedModeToE2eeMode(stored: string | null | undefined): E2eeMode | null {
  if (stored === "symmetric" || stored === "asymmetric") return stored;
  if (stored === "pqc_kyber" || stored === "pqc_dilithium") return stored;
  return null;
}

export function resolveE2eeAuthorization(
  requestedScopes: string[],
  existing?: { appEncryptionMode?: string | null } | null,
): { mode: E2eeMode | null; reset: boolean } {
  const reset = hasE2eeResetScope(requestedScopes);
  const matched = requestedScopes
    .filter(isE2eeModeScope)
    .map((scope) => e2eeModeForScope(normalizeScopeToken(scope) as E2eeScope));

  const unique = [...new Set(matched)];
  let mode = unique.length === 1 ? unique[0]! : null;

  if (reset && !mode && existing?.appEncryptionMode) {
    mode = storedModeToE2eeMode(existing.appEncryptionMode);
  }

  return { mode, reset };
}

export function resolveRequestedE2eeMode(
  requestedScopes: string[],
  existing?: { appEncryptionMode?: string | null } | null,
): E2eeMode | null {
  return resolveE2eeAuthorization(requestedScopes, existing).mode;
}

export function authorizationHasE2eeMaterial(
  auth: {
    encryptedAppKey?: string | null;
    appPublicKey?: string | null;
    encryptedAppPrivateKey?: string | null;
    appEncryptionMode?: string | null;
  } | null | undefined,
  mode?: E2eeMode | null,
): boolean {
  if (!auth) return false;
  const resolved = mode ?? storedModeToE2eeMode(auth.appEncryptionMode);
  if (resolved === "symmetric") return !!auth.encryptedAppKey;
  if (resolved === "asymmetric") {
    return !!auth.appPublicKey && !!auth.encryptedAppPrivateKey;
  }
  return !!auth.encryptedAppKey || !!auth.appPublicKey;
}
