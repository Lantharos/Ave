export type BusinessRole = "owner" | "admin" | "signer" | "member" | "viewer";
export type BusinessEncryptionMode = "standard" | "enterprise_managed" | "e2ee";
export type KmsProvider = "aws_kms" | "azure_key_vault" | "gcp_kms" | "external";

export type BusinessScope =
  | "read"
  | "sign"
  | "approve"
  | "manage_identities"
  | "manage_keys"
  | "manage_sso"
  | "manage_org";

export interface BusinessIdentity {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  isPrimary?: boolean;
}

export interface BusinessOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  verifiedDomains: string[];
  ssoRequired: boolean;
  role: BusinessRole;
  scopes: BusinessScope[];
  actingIdentityId: string;
  actingHandle: string;
}

export interface BusinessMember {
  id: string;
  identityId: string;
  handle: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  role: BusinessRole;
  scopes: BusinessScope[];
  signingAuthority: boolean;
  status: string;
  publicKey?: string | null;
  hasEncryptionKey: boolean;
  joinedAt: string;
}

export interface BusinessKey {
  id: string;
  name: string;
  resource?: string | null;
  status: string;
  encryptionMode: BusinessEncryptionMode;
  epoch: number;
  rotatedFromKeyringId?: string | null;
  keyProviderRef?: string | null;
  grants: { id: string; identityId: string; status: string; wrapVersion: string; revokedAt?: string | null; createdAt: string }[];
  createdAt: string;
}

export interface BusinessEncryptionPolicy {
  id?: string | null;
  organizationId: string;
  mode: BusinessEncryptionMode;
  status: string;
  kmsProvider?: KmsProvider | null;
  kmsKeyRef?: string | null;
  kmsKeyVersion?: string | null;
  requireIdentityKeys: boolean;
  rotatedAt?: string | null;
  updatedAt?: string | null;
}

export interface BusinessDomain {
  id: string;
  domain: string;
  token: string;
  status: "pending" | "verified";
  verifiedAt?: string | null;
  createdAt: string;
}

export interface BusinessSsoConnection {
  id: string;
  type: "saml" | "oidc";
  provider: string;
  name: string;
  domain?: string | null;
  status: "draft" | "active" | "disabled";
  issuer?: string | null;
  clientId?: string | null;
  keyAccessMode: string;
  e2eeSupported: boolean;
  e2eeNote: string;
  saml?: {
    entityId: string;
    acsUrl: string;
    metadataUrl: string;
  } | null;
  createdAt: string;
}

export interface BusinessAuditEvent {
  id: string;
  action: string;
  details?: Record<string, unknown> | null;
  signatureStatus: "verified" | "not_provided" | "missing_key" | "invalid";
  createdAt: string;
}

export interface BusinessOrganizationDetail {
  organization: BusinessOrganizationSummary;
  members: BusinessMember[];
  keys: BusinessKey[];
  encryptionPolicy: BusinessEncryptionPolicy;
  domains: BusinessDomain[];
  ssoConnections: BusinessSsoConnection[];
  auditEvents: BusinessAuditEvent[];
}
