import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  encryptedMasterKeyBackup: text("encrypted_master_key_backup"),
});

export const identities = sqliteTable("identities", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),

  displayName: text("display_name").notNull(),
  handle: text("handle").notNull().unique(), // plaintext for lookup
  email: text("email"),
  pendingEmail: text("pending_email"),
  emailVerificationCodeHash: text("email_verification_code_hash"),
  emailVerificationExpiresAt: integer("email_verification_expires_at", { mode: "timestamp_ms" }),
  emailVerificationSentAt: integer("email_verification_sent_at", { mode: "timestamp_ms" }),
  birthday: text("birthday"),
  avatarUrl: text("avatar_url"),
  isPrimary: integer("is_primary", { mode: "boolean" }).default(false).notNull(),
}, (table) => [
  index("identities_user_id_idx").on(table.userId),
  index("identities_handle_idx").on(table.handle),
]);

export const passkeys = sqliteTable("passkeys", {
  id: text("id").primaryKey(), // credential ID from WebAuthn
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  publicKey: text("public_key").notNull(), // base64 encoded
  counter: integer("counter").notNull().default(0),
  deviceType: text("device_type"), // platform, cross-platform
  backedUp: integer("backed_up", { mode: "boolean" }).default(false),
  transports: text("transports", { mode: "json" }).$type<string[]>(),
  name: text("name"),
  prfEncryptedMasterKey: text("prf_encrypted_master_key"),
  prfSalt: text("prf_salt"),
}, (table) => [
  index("passkeys_user_id_idx").on(table.userId),
]);

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  name: text("name").notNull(),
  type: text("type").notNull(), // phone, computer, tablet
  browser: text("browser"),
  os: text("os"),
  fingerprint: text("fingerprint"),
  pushSubscription: text("push_subscription", { mode: "json" }),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
}, (table) => [
  index("devices_user_id_idx").on(table.userId),
  index("devices_fingerprint_idx").on(table.fingerprint),
  index("devices_user_fingerprint_idx").on(table.userId, table.fingerprint),
]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  deviceId: text("device_id").references(() => devices.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  authMethod: text("auth_method"),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
  index("sessions_token_hash_idx").on(table.tokenHash),
]);

export const loginRequests = sqliteTable("login_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  identityId: text("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
  deviceName: text("device_name"),
  deviceType: text("device_type"),
  browser: text("browser"),
  os: text("os"),
  fingerprint: text("fingerprint"),
  ipAddress: text("ip_address"),
  requesterPublicKey: text("requester_public_key").notNull(),
  requesterTokenHash: text("requester_token_hash").notNull().default(""),
  status: text("status").notNull().default("pending"), // pending, approved, denied, expired, consumed
  encryptedMasterKey: text("encrypted_master_key"),
  approvedByDeviceId: text("approved_by_device_id").references(() => devices.id, { onDelete: "set null" }),
  approverPublicKey: text("approver_public_key"),
}, (table) => [
  index("login_requests_identity_id_idx").on(table.identityId),
  index("login_requests_status_idx").on(table.status),
]);

export const trustCodes = sqliteTable("trust_codes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  codeHash: text("code_hash").notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
}, (table) => [
  index("trust_codes_user_id_idx").on(table.userId),
]);

export const identityEncryptionKeys = sqliteTable("identity_encryption_keys", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  identityId: text("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  publicKey: text("public_key").notNull(),
  encryptedPrivateKey: text("encrypted_private_key").notNull(),
}, (table) => [
  index("identity_encryption_keys_identity_id_idx").on(table.identityId),
]);

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
