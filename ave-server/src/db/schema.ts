import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";

// Users table - core account (not identity)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  
  // E2EE: encrypted master key backup (only decryptable with trust codes)
  // The server stores this but cannot decrypt it
  encryptedMasterKeyBackup: text("encrypted_master_key_backup"),
  
  // Security questions (hashed answers for account recovery)
  securityQuestions: jsonb("security_questions").$type<{
    questionId: number;
    answerHash: string;
  }[]>(),
});

// Identities - users can have multiple identities (up to 5)
export const identities = pgTable("identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  
  // Identity info (encrypted on client, stored as ciphertext)
  displayName: text("display_name").notNull(), // encrypted
  handle: varchar("handle", { length: 32 }).notNull().unique(), // plaintext for lookup
  email: text("email"), // encrypted
  birthday: text("birthday"), // encrypted
  
  // Avatar and banner URLs (stored in object storage)
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  
  // Is this the primary identity?
  isPrimary: boolean("is_primary").default(false).notNull(),
}, (table) => [
  index("identities_user_id_idx").on(table.userId),
  index("identities_handle_idx").on(table.handle),
]);

// Passkeys (WebAuthn credentials)
export const passkeys = pgTable("passkeys", {
  id: text("id").primaryKey(), // credential ID from WebAuthn
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  
  // WebAuthn credential data
  publicKey: text("public_key").notNull(), // base64 encoded
  counter: integer("counter").notNull().default(0),
  deviceType: varchar("device_type", { length: 32 }), // platform, cross-platform
  backedUp: boolean("backed_up").default(false),
  transports: jsonb("transports").$type<string[]>(),
  
  // User-friendly name
  name: varchar("name", { length: 64 }),
  
  // PRF extension support - master key encrypted with PRF output
  // This allows decrypting the master key during passkey login without needing trust codes
  prfEncryptedMasterKey: text("prf_encrypted_master_key"),
  // PRF salt used for this passkey (base64)
  prfSalt: text("prf_salt"),
}, (table) => [
  index("passkeys_user_id_idx").on(table.userId),
]);

// Trusted devices - devices that have the master key
export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  
  // Device info
  name: varchar("name", { length: 64 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(), // phone, computer, tablet
  browser: varchar("browser", { length: 64 }),
  os: varchar("os", { length: 64 }),
  
  // Unique fingerprint for this device/browser combination (stored in client localStorage)
  fingerprint: varchar("fingerprint", { length: 64 }),
  
  // For push notifications / real-time
  pushSubscription: jsonb("push_subscription"),
  
  // Is this device currently active in a session?
  isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
  index("devices_user_id_idx").on(table.userId),
  index("devices_fingerprint_idx").on(table.fingerprint),
]);

// Sessions - active login sessions
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  deviceId: uuid("device_id").references(() => devices.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  
  // Session token (hashed)
  tokenHash: text("token_hash").notNull().unique(),
  
  // IP and location info for activity log
  ipAddress: varchar("ip_address", { length: 90 }),
  userAgent: text("user_agent"),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
  index("sessions_token_hash_idx").on(table.tokenHash),
]);

// Login requests - pending login attempts that need approval
export const loginRequests = pgTable("login_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  
  // Who is trying to log in
  handle: varchar("handle", { length: 32 }).notNull(),
  
  // Device info of the requesting device
  deviceName: varchar("device_name", { length: 64 }),
  deviceType: varchar("device_type", { length: 32 }),
  browser: varchar("browser", { length: 64 }),
  os: varchar("os", { length: 64 }),
  fingerprint: varchar("fingerprint", { length: 64 }),
  ipAddress: varchar("ip_address", { length: 90 }),
  
  // Ephemeral key exchange for E2EE key transfer
  // The requesting device generates a keypair, stores private locally, sends public here
  requesterPublicKey: text("requester_public_key").notNull(),
  
  // Status
  status: varchar("status", { length: 16 }).notNull().default("pending"), // pending, approved, denied, expired
  
  // When approved, the approving device encrypts the master key with requester's public key
  encryptedMasterKey: text("encrypted_master_key"),
  
  // Which device approved it
  approvedByDeviceId: uuid("approved_by_device_id").references(() => devices.id),
  approverPublicKey: text("approver_public_key"),
}, (table) => [
  index("login_requests_handle_idx").on(table.handle),
  index("login_requests_status_idx").on(table.status),
]);

// Trust codes - backup codes for account recovery
export const trustCodes = pgTable("trust_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  // Hashed code (the actual code is only shown once to user)
  codeHash: text("code_hash").notNull(),
  
  // Has this code been used?
  usedAt: timestamp("used_at"),
}, (table) => [
  index("trust_codes_user_id_idx").on(table.userId),
]);

// Activity log - audit trail
export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  // What happened
  action: varchar("action", { length: 64 }).notNull(),
  // login, logout, login_denied, device_added, device_removed, 
  // passkey_added, passkey_removed, identity_created, identity_updated,
  // security_questions_updated, trust_codes_regenerated, account_recovered
  
  // Additional context
  details: jsonb("details").$type<Record<string, unknown>>(),
  
  // Where it happened from
  deviceId: uuid("device_id").references(() => devices.id),
  ipAddress: varchar("ip_address", { length: 90 }),
  userAgent: text("user_agent"),
  
  // Color coding for UI
  severity: varchar("severity", { length: 16 }).default("info"), // info, warning, danger
}, (table) => [
  index("activity_logs_user_id_idx").on(table.userId),
  index("activity_logs_created_at_idx").on(table.createdAt),
]);

// OAuth applications (third-party apps using Ave for auth)
export const oauthApps = pgTable("oauth_apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  // App info
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  websiteUrl: text("website_url"),
  
  // OAuth credentials
  clientId: varchar("client_id", { length: 64 }).notNull().unique(),
  clientSecretHash: text("client_secret_hash").notNull(),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
  
  // OIDC settings
  allowedScopes: jsonb("allowed_scopes").$type<string[]>().default(["openid", "profile", "email", "offline_access"]),
  accessTokenTtlSeconds: integer("access_token_ttl_seconds").default(3600).notNull(),
  refreshTokenTtlSeconds: integer("refresh_token_ttl_seconds").default(30 * 24 * 60 * 60).notNull(),
  allowUserIdScope: boolean("allow_user_id_scope").default(false).notNull(),
  
  // Does this app support E2EE?
  supportsE2ee: boolean("supports_e2ee").default(false),
  
  // Developer who owns this app
  ownerId: uuid("owner_id").references(() => users.id),
});

// OAuth refresh tokens
export const oauthRefreshTokens = pgTable("oauth_refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  expiresAt: timestamp("expires_at").notNull(),
  
  // Who + app
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  identityId: uuid("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
  appId: uuid("app_id").references(() => oauthApps.id, { onDelete: "cascade" }).notNull(),
  
  // Token info
  tokenHash: text("token_hash").notNull().unique(),
  scope: text("scope").notNull(),
  rotatedFromId: uuid("rotated_from_id"),
  reuseDetectedAt: timestamp("reuse_detected_at"),
}, (table) => [
  index("oauth_refresh_tokens_user_id_idx").on(table.userId),
  index("oauth_refresh_tokens_app_id_idx").on(table.appId),
  index("oauth_refresh_tokens_identity_id_idx").on(table.identityId),
  index("oauth_refresh_tokens_token_hash_idx").on(table.tokenHash),
]);

// OAuth authorizations - which apps a user has authorized
export const oauthAuthorizations = pgTable("oauth_authorizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  appId: uuid("app_id").references(() => oauthApps.id, { onDelete: "cascade" }).notNull(),
  identityId: uuid("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  // E2EE: encrypted keys for this app (encrypted with user's master key)
  // Each app gets its own encryption key that the user controls
  encryptedAppKey: text("encrypted_app_key"),
}, (table) => [
  index("oauth_authorizations_user_id_idx").on(table.userId),
  index("oauth_authorizations_app_id_idx").on(table.appId),
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

