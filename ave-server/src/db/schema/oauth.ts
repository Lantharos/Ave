import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { identities, users } from "./accounts";
import { oauthApps } from "./developer";

export const oauthRefreshTokens = sqliteTable("oauth_refresh_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  authorizationId: text("authorization_id").references(() => oauthAuthorizations.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  identityId: text("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
  appId: text("app_id").references(() => oauthApps.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  scope: text("scope").notNull(),
  familyId: text("family_id"),
  rotatedFromId: text("rotated_from_id"),
  reuseDetectedAt: integer("reuse_detected_at", { mode: "timestamp_ms" }),
}, (table) => [
  index("oauth_refresh_tokens_user_id_idx").on(table.userId),
  index("oauth_refresh_tokens_app_id_idx").on(table.appId),
  index("oauth_refresh_tokens_identity_id_idx").on(table.identityId),
  index("oauth_refresh_tokens_token_hash_idx").on(table.tokenHash),
  index("oauth_refresh_tokens_family_id_idx").on(table.familyId),
  index("oauth_refresh_tokens_rotated_from_id_idx").on(table.rotatedFromId),
  index("oauth_refresh_tokens_authorization_id_idx").on(table.authorizationId),
]);

export const oauthAuthorizationCodes = sqliteTable("oauth_authorization_codes", {
  id: text("id").primaryKey(),
  authorizationId: text("authorization_id").references(() => oauthAuthorizations.id, { onDelete: "cascade" }),
  value: text("value", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("oauth_authorization_codes_expires_at_idx").on(table.expiresAt),
  index("oauth_authorization_codes_authorization_id_idx").on(table.authorizationId),
]);

export const oauthAccessTokens = sqliteTable("oauth_access_tokens", {
  id: text("id").primaryKey(),
  authorizationId: text("authorization_id").references(() => oauthAuthorizations.id, { onDelete: "cascade" }),
  value: text("value", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("oauth_access_tokens_expires_at_idx").on(table.expiresAt),
  index("oauth_access_tokens_authorization_id_idx").on(table.authorizationId),
]);

export const oauthAuthorizations = sqliteTable("oauth_authorizations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  scope: text("scope").notNull().default(""),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  appId: text("app_id").references(() => oauthApps.id, { onDelete: "cascade" }).notNull(),
  identityId: text("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  lastAuthorizedAt: integer("last_authorized_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
  authorizationCount: integer("authorization_count").notNull().default(1),
  lastAuthMethod: text("last_auth_method"),
  encryptedAppKey: text("encrypted_app_key"),
  appPublicKey: text("app_public_key"),
  encryptedAppPrivateKey: text("encrypted_app_private_key"),
  appEncryptionMode: text("app_encryption_mode"),
}, (table) => [
  index("oauth_authorizations_user_id_idx").on(table.userId),
  index("oauth_authorizations_app_id_idx").on(table.appId),
  index("oauth_authorizations_identity_id_idx").on(table.identityId),
  index("oauth_authorizations_user_app_idx").on(table.userId, table.appId),
  uniqueIndex("oauth_authorizations_user_app_identity_unique").on(table.userId, table.appId, table.identityId),
  index("oauth_authorizations_app_public_key_idx").on(table.appId, table.appPublicKey),
]);

export type OAuthAuthorization = typeof oauthAuthorizations.$inferSelect;
export type OAuthRefreshToken = typeof oauthRefreshTokens.$inferSelect;
export type NewOAuthRefreshToken = typeof oauthRefreshTokens.$inferInsert;
