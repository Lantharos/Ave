import { getApiBase } from "./api-base.js";
import type { AveIdTokenClaims, AveJwtClaims, JwtPayload, UserInfo } from "./types.js";

export type AveWorkspaceRole = "owner" | "admin" | "signer" | "member" | "viewer" | (string & {});
export type AveWorkspaceScope =
  | "read"
  | "sign"
  | "approve"
  | "manage_identities"
  | "manage_keys"
  | "manage_sso"
  | "manage_org"
  | (string & {});
export type AveWorkspaceEncryptionMode = "standard" | "enterprise_managed" | "e2ee" | (string & {});
export type AveWorkspaceKeyCustody = "ave_standard" | "customer_kms" | "identity_grants" | (string & {});
export type AveWorkspaceAuthMethod = "ave_session" | "enterprise_sso" | (string & {});

export interface AveWorkspaceContext {
  id: string;
  name?: string;
  memberId?: string;
  role?: AveWorkspaceRole;
  scopes: AveWorkspaceScope[];
  signingAuthority: boolean;
  encryptionMode?: AveWorkspaceEncryptionMode;
  keyCustody?: AveWorkspaceKeyCustody;
  authMethod?: AveWorkspaceAuthMethod;
  ssoConnectionId?: string;
  identityId?: string;
}

type WorkspaceClaims = Pick<JwtPayload, "sub"> & {
  auth_context?: unknown;
  org_id?: unknown;
  org_name?: unknown;
  org_member_id?: unknown;
  org_role?: unknown;
  org_scopes?: unknown;
  org_signing_authority?: unknown;
  org_encryption_mode?: unknown;
  org_key_custody?: unknown;
  auth_method?: unknown;
  sso_connection_id?: unknown;
};

const roleRank: Record<string, number> = {
  owner: 5,
  admin: 4,
  signer: 3,
  member: 2,
  viewer: 1,
};

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function scopeValues(value: unknown): AveWorkspaceScope[] {
  if (!Array.isArray(value)) return [];
  return value.filter((scope): scope is AveWorkspaceScope => typeof scope === "string" && scope.length > 0);
}

export function getAveWorkspaceContext(
  claims: AveJwtClaims | AveIdTokenClaims | JwtPayload | null | undefined
): AveWorkspaceContext | null {
  if (!claims) return null;

  const source = claims as WorkspaceClaims;
  const id = stringValue(source.org_id);
  if (!id || source.auth_context !== "organization") return null;

  return {
    id,
    name: stringValue(source.org_name),
    memberId: stringValue(source.org_member_id),
    role: stringValue(source.org_role) as AveWorkspaceRole | undefined,
    scopes: scopeValues(source.org_scopes),
    signingAuthority: source.org_signing_authority === true,
    encryptionMode: stringValue(source.org_encryption_mode) as AveWorkspaceEncryptionMode | undefined,
    keyCustody: stringValue(source.org_key_custody) as AveWorkspaceKeyCustody | undefined,
    authMethod: stringValue(source.auth_method) as AveWorkspaceAuthMethod | undefined,
    ssoConnectionId: stringValue(source.sso_connection_id),
    identityId: stringValue(source.sub),
  };
}

export function getAveWorkspaceContextFromUserInfo(userInfo: UserInfo | null | undefined): AveWorkspaceContext | null {
  const organization = userInfo?.organization;
  if (!organization?.id) return null;

  return {
    id: organization.id,
    name: organization.name,
    memberId: organization.memberId,
    role: organization.role as AveWorkspaceRole | undefined,
    scopes: organization.scopes as AveWorkspaceScope[],
    signingAuthority: organization.signingAuthority,
    encryptionMode: organization.encryptionMode as AveWorkspaceEncryptionMode | undefined,
    keyCustody: organization.keyCustody as AveWorkspaceKeyCustody | undefined,
    authMethod: organization.authMethod as AveWorkspaceAuthMethod | undefined,
    ssoConnectionId: organization.ssoConnectionId,
    identityId: userInfo?.sub,
  };
}

export interface AveWorkspaceOrganization {
  id: string;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  role?: AveWorkspaceRole;
  scopes: AveWorkspaceScope[];
  signingAuthority: boolean;
  ssoRequired: boolean;
  encryptionMode?: AveWorkspaceEncryptionMode;
  keyCustody?: AveWorkspaceKeyCustody;
}

export async function listAveWorkspaceOrganizations(
  config: { issuer?: string; clientId?: string; fetcher?: typeof fetch },
  accessToken: string
): Promise<AveWorkspaceOrganization[]> {
  const fetcher = config.fetcher ?? globalThis.fetch;
  if (!fetcher) {
    throw new Error("No fetch implementation available for Ave workspace organization lookup.");
  }

  const url = new URL(`${getApiBase(config.issuer)}/api/oauth/organizations`);
  if (config.clientId) {
    url.searchParams.set("client_id", config.clientId);
  }

  const response = await fetcher(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string; error_description?: string };
    throw new Error(data.error_description || data.error || `Failed to list Ave workspace organizations (${response.status})`);
  }

  const payload = await response.json() as { organizations?: AveWorkspaceOrganization[] };
  return payload.organizations || [];
}

export async function createAveWorkspaceOrganization(
  config: { issuer?: string; clientId?: string; fetcher?: typeof fetch },
  accessToken: string,
  params: {
    name: string;
    clientId?: string;
    userConfirmedAveWorkspaceCreation: true;
  }
): Promise<AveWorkspaceOrganization> {
  const fetcher = config.fetcher ?? globalThis.fetch;
  if (!fetcher) {
    throw new Error("No fetch implementation available for Ave workspace creation.");
  }

  const response = await fetcher(`${getApiBase(config.issuer)}/api/oauth/workspaces`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      client_id: params.clientId ?? config.clientId,
      userConfirmedAveWorkspaceCreation: params.userConfirmedAveWorkspaceCreation,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string; error_description?: string };
    throw new Error(data.error_description || data.error || `Failed to create Ave workspace organization (${response.status})`);
  }

  const payload = await response.json() as { organization?: AveWorkspaceOrganization };
  if (!payload.organization) {
    throw new Error("Ave workspace creation response did not include an organization.");
  }
  return payload.organization;
}

export function requireAveWorkspaceContext(
  claims: AveJwtClaims | AveIdTokenClaims | JwtPayload | null | undefined
): AveWorkspaceContext {
  const context = getAveWorkspaceContext(claims);
  if (!context) {
    throw new Error("Ave workspace context is required. Start sign-in with organizationId and verify an organization-context token.");
  }
  return context;
}

export function hasAveWorkspaceScope(context: AveWorkspaceContext | null | undefined, scope: AveWorkspaceScope): boolean {
  if (!context) return false;
  if (context.role === "owner") return true;
  return context.scopes.includes(scope);
}

export function hasAveWorkspaceRole(context: AveWorkspaceContext | null | undefined, minimumRole: AveWorkspaceRole): boolean {
  if (!context?.role) return false;
  const actualRank = roleRank[context.role];
  const minimumRank = roleRank[minimumRole];
  if (actualRank === undefined || minimumRank === undefined) return context.role === minimumRole;
  return actualRank >= minimumRank;
}
