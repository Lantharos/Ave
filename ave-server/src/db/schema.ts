import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Users table - core account (not identity)
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  
  // E2EE: encrypted master key backup (only decryptable with trust codes)
  // The server stores this but cannot decrypt it
  encryptedMasterKeyBackup: text("encrypted_master_key_backup"),
  
  // Security questions (hashed answers for account recovery)
  securityQuestions: text("security_questions", { mode: "json" }).$type<{
    questionId: number;
    answerHash: string;
  }[]>(),
});

// Identities - users can have multiple identities (up to 5)
export const identities = sqliteTable("identities", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  
  // Identity info (encrypted on client, stored as ciphertext)
  displayName: text("display_name").notNull(), // encrypted
  handle: text("handle").notNull().unique(), // plaintext for lookup
  email: text("email"), // encrypted
  birthday: text("birthday"), // encrypted
  
  // Avatar and banner URLs (stored in object storage)
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  
  // Is this the primary identity?
  isPrimary: integer("is_primary", { mode: "boolean" }).default(false).notNull(),
}, (table) => [
  index("identities_user_id_idx").on(table.userId),
  index("identities_handle_idx").on(table.handle),
]);

// Passkeys (WebAuthn credentials)
export const passkeys = sqliteTable("passkeys", {
  id: text("id").primaryKey(), // credential ID from WebAuthn
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  
  // WebAuthn credential data
  publicKey: text("public_key").notNull(), // base64 encoded
  counter: integer("counter").notNull().default(0),
  deviceType: text("device_type"), // platform, cross-platform
  backedUp: integer("backed_up", { mode: "boolean" }).default(false),
  transports: text("transports", { mode: "json" }).$type<string[]>(),
  
  // User-friendly name
  name: text("name"),
  
  // PRF extension support - master key encrypted with PRF output
  // This allows decrypting the master key during passkey login without needing trust codes
  prfEncryptedMasterKey: text("prf_encrypted_master_key"),
  // PRF salt used for this passkey (base64)
  prfSalt: text("prf_salt"),
}, (table) => [
  index("passkeys_user_id_idx").on(table.userId),
]);

// Trusted devices - devices that have the master key
export const devices = sqliteTable("devices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  
  // Device info
  name: text("name").notNull(),
  type: text("type").notNull(), // phone, computer, tablet
  browser: text("browser"),
  os: text("os"),
  
  // Unique fingerprint for this device/browser combination (stored in client localStorage)
  fingerprint: text("fingerprint"),
  
  // For push notifications / real-time
  pushSubscription: text("push_subscription", { mode: "json" }),
  
  // Is this device currently active in a session?
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
}, (table) => [
  index("devices_user_id_idx").on(table.userId),
  index("devices_fingerprint_idx").on(table.fingerprint),
]);

// Sessions - active login sessions
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  deviceId: text("device_id").references(() => devices.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  
  // Session token (hashed)
  tokenHash: text("token_hash").notNull().unique(),
  
  // IP and location info for activity log
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
  index("sessions_token_hash_idx").on(table.tokenHash),
]);

// Login requests - pending login attempts that need approval
export const loginRequests = sqliteTable("login_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  
  // Who is trying to log in
  handle: text("handle").notNull(),
  
  // Device info of the requesting device
  deviceName: text("device_name"),
  deviceType: text("device_type"),
  browser: text("browser"),
  os: text("os"),
  fingerprint: text("fingerprint"),
  ipAddress: text("ip_address"),
  
  // Ephemeral key exchange for E2EE key transfer
  // The requesting device generates a keypair, stores private locally, sends public here
  requesterPublicKey: text("requester_public_key").notNull(),
  
  // Status
  status: text("status").notNull().default("pending"), // pending, approved, denied, expired
  
  // When approved, the approving device encrypts the master key with requester's public key
  encryptedMasterKey: text("encrypted_master_key"),
  
  // Which device approved it
  approvedByDeviceId: text("approved_by_device_id").references(() => devices.id),
  approverPublicKey: text("approver_public_key"),
}, (table) => [
  index("login_requests_handle_idx").on(table.handle),
  index("login_requests_status_idx").on(table.status),
]);

// Trust codes - backup codes for account recovery
export const trustCodes = sqliteTable("trust_codes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  
  // Hashed code (the actual code is only shown once to user)
  codeHash: text("code_hash").notNull(),
  
  // Has this code been used?
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
}, (table) => [
  index("trust_codes_user_id_idx").on(table.userId),
]);

// Activity log - audit trail
export const activityLogs = sqliteTable("activity_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  
  // What happened
  action: text("action").notNull(),
  // login, logout, login_denied, device_added, device_removed, 
  // passkey_added, passkey_removed, identity_created, identity_updated,
  // security_questions_updated, trust_codes_regenerated, account_recovered
  
  // Additional context
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  
  // Where it happened from
  deviceId: text("device_id").references(() => devices.id),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Color coding for UI
  severity: text("severity").default("info"), // info, warning, danger
}, (table) => [
  index("activity_logs_user_id_idx").on(table.userId),
  index("activity_logs_created_at_idx").on(table.createdAt),
]);

// OAuth applications (third-party apps using Ave for auth)
export const oauthApps = sqliteTable("oauth_apps", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  
  // App info
  name: text("name").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  websiteUrl: text("website_url"),
  
  // OAuth credentials
  clientId: text("client_id").notNull().unique(),
  clientSecretHash: text("client_secret_hash").notNull(),
  redirectUris: text("redirect_uris", { mode: "json" }).$type<string[]>().notNull(),
  
  // OIDC settings
  allowedScopes: text("allowed_scopes", { mode: "json" })
    .$type<string[]>()
    .$defaultFn(() => ["openid", "profile", "email", "offline_access"]),
  accessTokenTtlSeconds: integer("access_token_ttl_seconds").default(3600).notNull(),
  refreshTokenTtlSeconds: integer("refresh_token_ttl_seconds").default(30 * 24 * 60 * 60).notNull(),
  allowUserIdScope: integer("allow_user_id_scope", { mode: "boolean" }).default(false).notNull(),
  
  // Does this app support E2EE?
  supportsE2ee: integer("supports_e2ee", { mode: "boolean" }).default(false),
  
  // Developer who owns this app
  ownerId: text("owner_id").references(() => users.id),
});

// OAuth refresh tokens
export const oauthRefreshTokens = sqliteTable("oauth_refresh_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  
  // Who + app
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  identityId: text("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
  appId: text("app_id").references(() => oauthApps.id, { onDelete: "cascade" }).notNull(),
  
  // Token info
  tokenHash: text("token_hash").notNull().unique(),
  scope: text("scope").notNull(),
  rotatedFromId: text("rotated_from_id"),
  reuseDetectedAt: integer("reuse_detected_at", { mode: "timestamp_ms" }),
}, (table) => [
  index("oauth_refresh_tokens_user_id_idx").on(table.userId),
  index("oauth_refresh_tokens_app_id_idx").on(table.appId),
  index("oauth_refresh_tokens_identity_id_idx").on(table.identityId),
  index("oauth_refresh_tokens_token_hash_idx").on(table.tokenHash),
]);

// OAuth authorizations - which apps a user has authorized
export const oauthAuthorizations = sqliteTable("oauth_authorizations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  appId: text("app_id").references(() => oauthApps.id, { onDelete: "cascade" }).notNull(),
  identityId: text("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  
  // E2EE: encrypted keys for this app (encrypted with user's master key)
  // Each app gets its own encryption key that the user controls
  encryptedAppKey: text("encrypted_app_key"),
}, (table) => [
  index("oauth_authorizations_user_id_idx").on(table.userId),
  index("oauth_authorizations_app_id_idx").on(table.appId),
]);

// Signing keys - Ed25519 keypairs per identity for Ave Signing
export const signingKeys = sqliteTable("signing_keys", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  identityId: text("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  
  // Ed25519 public key (base64 encoded, 32 bytes)
  publicKey: text("public_key").notNull(),
  
  // Private key encrypted with user's master key (base64 encoded)
  // Only decryptable client-side
  encryptedPrivateKey: text("encrypted_private_key").notNull(),
}, (table) => [
  index("signing_keys_identity_id_idx").on(table.identityId),
]);

// Signature requests - pending requests from apps for user signatures
export const signatureRequests = sqliteTable("signature_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  
  // Which identity is being asked to sign
  identityId: text("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
  
  // Which app is requesting
  appId: text("app_id").references(() => oauthApps.id, { onDelete: "cascade" }).notNull(),
  
  // What to sign - the message/payload (plaintext, shown to user)
  payload: text("payload").notNull(),
  
  // Optional: structured metadata about what this signature is for
  // e.g. { type: "consent", action: "terms_acceptance", version: "1.0" }
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  
  // Status: pending, signed, denied, expired
  status: text("status").notNull().default("pending"),
  
  // The signature (base64 Ed25519 signature, 64 bytes) - filled when signed
  signature: text("signature"),
  
  // When was it signed/denied
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  
  // Device that signed it
  deviceId: text("device_id").references(() => devices.id),
}, (table) => [
  index("signature_requests_identity_id_idx").on(table.identityId),
  index("signature_requests_app_id_idx").on(table.appId),
  index("signature_requests_status_idx").on(table.status),
]);

// Types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Identity = typeof identities.$inferSelect;
export type NewIdentity = typeof identities.$inferInsert;
export type Passkey = typeof passkeys.$inferSelect;
export type NewPasskey = typeof passkeys.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type LoginRequest = typeof loginRequests.$inferSelect;
export type NewLoginRequest = typeof loginRequests.$inferInsert;
export type TrustCode = typeof trustCodes.$inferSelect;
export type NewTrustCode = typeof trustCodes.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type OAuthApp = typeof oauthApps.$inferSelect;
export type OAuthAuthorization = typeof oauthAuthorizations.$inferSelect;
export type OAuthRefreshToken = typeof oauthRefreshTokens.$inferSelect;
export type NewOAuthRefreshToken = typeof oauthRefreshTokens.$inferInsert;
export type SigningKey = typeof signingKeys.$inferSelect;
export type NewSigningKey = typeof signingKeys.$inferInsert;
export type SignatureRequest = typeof signatureRequests.$inferSelect;
export type NewSignatureRequest = typeof signatureRequests.$inferInsert;
