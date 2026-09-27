import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { devices, identities } from "./accounts";
import { oauthApps } from "./developer";

export const signingKeys = sqliteTable("signing_keys", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  identityId: text("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  publicKey: text("public_key").notNull(),
  encryptedPrivateKey: text("encrypted_private_key").notNull(),
}, (table) => [
  index("signing_keys_identity_id_idx").on(table.identityId),
]);

export const signatureRequests = sqliteTable("signature_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  identityId: text("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
  appId: text("app_id").references(() => oauthApps.id, { onDelete: "cascade" }).notNull(),
  payload: text("payload").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  status: text("status").notNull().default("pending"),
  signature: text("signature"),
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  deviceId: text("device_id").references(() => devices.id, { onDelete: "set null" }),
}, (table) => [
  index("signature_requests_identity_id_idx").on(table.identityId),
  index("signature_requests_app_id_idx").on(table.appId),
  index("signature_requests_status_idx").on(table.status),
]);

export type SigningKey = typeof signingKeys.$inferSelect;
export type NewSigningKey = typeof signingKeys.$inferInsert;
export type SignatureRequest = typeof signatureRequests.$inferSelect;
export type NewSignatureRequest = typeof signatureRequests.$inferInsert;
