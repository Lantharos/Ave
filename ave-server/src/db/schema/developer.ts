import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { identities } from "./accounts";

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),

  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  slug: text("slug").notNull().unique(),
}, (table) => [
  index("organizations_slug_idx").on(table.slug),
]);

export const developerMembers = sqliteTable("developer_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  identityId: text("identity_id").references(() => identities.id, { onDelete: "cascade" }).notNull(),
}, (table) => [
  uniqueIndex("developer_members_org_identity_unique").on(table.organizationId, table.identityId),
  index("developer_members_identity_id_idx").on(table.identityId),
]);

export const oauthApps = sqliteTable("oauth_apps", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  name: text("name").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  websiteUrl: text("website_url"),
  clientId: text("client_id").notNull().unique(),
  clientSecretHash: text("client_secret_hash").notNull(),
  redirectUris: text("redirect_uris", { mode: "json" }).$type<string[]>().notNull(),
  developmentMode: integer("development_mode", { mode: "boolean" }).default(false).notNull(),
  allowedScopes: text("allowed_scopes", { mode: "json" })
    .$type<string[]>()
    .$defaultFn(() => ["openid", "profile", "email", "offline_access"]),
  accessTokenTtlSeconds: integer("access_token_ttl_seconds").default(3600).notNull(),
  refreshTokenTtlSeconds: integer("refresh_token_ttl_seconds").default(30 * 24 * 60 * 60).notNull(),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
}, (table) => [
  index("oauth_apps_organization_id_idx").on(table.organizationId),
]);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OAuthApp = typeof oauthApps.$inferSelect;
