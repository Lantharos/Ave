import { index, sqliteTable, text, uniqueIndex, integer } from "drizzle-orm/sqlite-core";
import { identities, organizations, users } from "./schema";

export const organizationKeyrings = sqliteTable("organization_keyrings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  resource: text("resource"),
  status: text("status").notNull().default("active"),
  encryptionMode: text("encryption_mode").notNull().default("e2ee"),
  epoch: integer("epoch").notNull().default(1),
  rotatedFromKeyringId: text("rotated_from_keyring_id"),
  keyProviderRef: text("key_provider_ref"),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdByIdentityId: text("created_by_identity_id").references(() => identities.id, { onDelete: "set null" }),
}, (table) => [
  index("organization_keyrings_organization_id_idx").on(table.organizationId),
  index("organization_keyrings_status_idx").on(table.status),
  index("organization_keyrings_rotated_from_idx").on(table.rotatedFromKeyringId),
]);

export const organizationKeyGrants = sqliteTable("organization_key_grants", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  keyringId: text("keyring_id").references(() => organizationKeyrings.id, { onDelete: "cascade" }).notNull(),
  identityId: text("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  senderPublicKey: text("sender_public_key").notNull(),
  recipientPublicKey: text("recipient_public_key").notNull(),
  wrapVersion: text("wrap_version").notNull().default("p256-aesgcm-v1"),
  status: text("status").notNull().default("active"),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
}, (table) => [
  uniqueIndex("organization_key_grants_keyring_identity_unique").on(table.keyringId, table.identityId),
  index("organization_key_grants_organization_id_idx").on(table.organizationId),
  index("organization_key_grants_keyring_id_idx").on(table.keyringId),
  index("organization_key_grants_identity_id_idx").on(table.identityId),
]);

export const organizationEncryptionPolicies = sqliteTable("organization_encryption_policies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  mode: text("mode").notNull().default("standard"),
  status: text("status").notNull().default("active"),
  kmsProvider: text("kms_provider"),
  kmsKeyRef: text("kms_key_ref"),
  kmsKeyVersion: text("kms_key_version"),
  requireIdentityKeys: integer("require_identity_keys", { mode: "boolean" }).default(false).notNull(),
  rotatedAt: integer("rotated_at", { mode: "timestamp_ms" }),
}, (table) => [
  uniqueIndex("organization_encryption_policies_org_unique").on(table.organizationId),
  index("organization_encryption_policies_mode_idx").on(table.mode),
]);

export const organizationSsoConnections = sqliteTable("organization_sso_connections", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  provider: text("provider").notNull().default("generic"),
  name: text("name").notNull(),
  domain: text("domain"),
  status: text("status").notNull().default("draft"),
  metadataUrl: text("metadata_url"),
  entityId: text("entity_id"),
  ssoUrl: text("sso_url"),
  x509Certificate: text("x509_certificate"),
  issuer: text("issuer"),
  authorizationEndpoint: text("authorization_endpoint"),
  tokenEndpoint: text("token_endpoint"),
  jwksUri: text("jwks_uri"),
  clientId: text("client_id"),
  encryptedClientSecret: text("encrypted_client_secret"),
  attributeMappings: text("attribute_mappings", { mode: "json" }).$type<Record<string, string>>().$defaultFn(() => ({})),
  keyAccessMode: text("key_access_mode").notNull().default("ave_identity_keys"),
}, (table) => [
  index("organization_sso_connections_organization_id_idx").on(table.organizationId),
  index("organization_sso_connections_status_idx").on(table.status),
  index("organization_sso_connections_domain_idx").on(table.domain),
]);

export const organizationDomainVerifications = sqliteTable("organization_domain_verifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  domain: text("domain").notNull(),
  token: text("token").notNull(),
  status: text("status").notNull().default("pending"),
  verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
}, (table) => [
  uniqueIndex("organization_domain_verifications_org_domain_unique").on(table.organizationId, table.domain),
  index("organization_domain_verifications_domain_idx").on(table.domain),
  index("organization_domain_verifications_status_idx").on(table.status),
]);

export const organizationAuditEvents = sqliteTable("organization_audit_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorIdentityId: text("actor_identity_id").references(() => identities.id, { onDelete: "set null" }),
  targetIdentityId: text("target_identity_id").references(() => identities.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  signaturePayload: text("signature_payload"),
  signature: text("signature"),
  signaturePublicKey: text("signature_public_key"),
  signatureStatus: text("signature_status").notNull().default("not_provided"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  severity: text("severity").notNull().default("info"),
}, (table) => [
  index("organization_audit_events_organization_id_idx").on(table.organizationId),
  index("organization_audit_events_actor_identity_id_idx").on(table.actorIdentityId),
  index("organization_audit_events_created_at_idx").on(table.createdAt),
]);

export type OrganizationKeyring = typeof organizationKeyrings.$inferSelect;
export type OrganizationKeyGrant = typeof organizationKeyGrants.$inferSelect;
export type OrganizationEncryptionPolicy = typeof organizationEncryptionPolicies.$inferSelect;
export type OrganizationSsoConnection = typeof organizationSsoConnections.$inferSelect;
export type OrganizationDomainVerification = typeof organizationDomainVerifications.$inferSelect;
export type OrganizationAuditEvent = typeof organizationAuditEvents.$inferSelect;
