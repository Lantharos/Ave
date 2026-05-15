import type { OrganizationEncryptionPolicy } from "../db";

export type OrganizationEncryptionMode = "standard" | "enterprise_managed" | "e2ee";
export type KmsProvider = "aws_kms" | "azure_key_vault" | "gcp_kms" | "external";

export const organizationEncryptionModes: OrganizationEncryptionMode[] = ["standard", "enterprise_managed", "e2ee"];
export const kmsProviders: KmsProvider[] = ["aws_kms", "azure_key_vault", "gcp_kms", "external"];

export function serializeEncryptionPolicy(policy: OrganizationEncryptionPolicy | null, organizationId: string) {
  return {
    id: policy?.id ?? null,
    organizationId,
    mode: (policy?.mode || "standard") as OrganizationEncryptionMode,
    status: policy?.status || "active",
    kmsProvider: (policy?.kmsProvider || null) as KmsProvider | null,
    kmsKeyRef: policy?.kmsKeyRef || null,
    kmsKeyVersion: policy?.kmsKeyVersion || null,
    requireIdentityKeys: !!policy?.requireIdentityKeys,
    rotatedAt: policy?.rotatedAt ?? null,
    updatedAt: policy?.updatedAt ?? null,
  };
}

export function normalizeKmsKeyRef(provider: KmsProvider, keyRef: string) {
  const value = keyRef.trim();
  if (!value) return { ok: false as const, error: "KMS key reference is required" };

  if (provider === "aws_kms") {
    const valid = /^arn:aws[a-z-]*:kms:[a-z0-9-]+:\d{12}:(key|alias)\/[A-Za-z0-9/_+=,.@-]+$/.test(value);
    return valid ? { ok: true as const, value } : { ok: false as const, error: "Use an AWS KMS key or alias ARN" };
  }

  if (provider === "azure_key_vault") {
    const valid = /^https:\/\/[A-Za-z0-9-]+\.(vault|managedhsm)\.azure\.[A-Za-z.]+\/keys\/[^/\s]+(?:\/[^/\s]+)?$/.test(value);
    return valid ? { ok: true as const, value } : { ok: false as const, error: "Use an Azure Key Vault or Managed HSM key identifier URL" };
  }

  if (provider === "gcp_kms") {
    const valid = /^projects\/[^/\s]+\/locations\/[^/\s]+\/keyRings\/[^/\s]+\/cryptoKeys\/[^/\s]+(?:\/cryptoKeyVersions\/[^/\s]+)?$/.test(value);
    return valid ? { ok: true as const, value } : { ok: false as const, error: "Use a Google Cloud KMS crypto key resource ID" };
  }

  return value.length >= 8
    ? { ok: true as const, value }
    : { ok: false as const, error: "External key reference is too short" };
}
