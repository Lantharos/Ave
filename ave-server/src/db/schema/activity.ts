import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { devices, identities, users } from "./accounts";
import { oauthApps } from "./developer";

export const activityLogs = sqliteTable("activity_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  action: text("action").notNull(),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  appId: text("app_id").references(() => oauthApps.id, { onDelete: "set null" }),
  deviceId: text("device_id").references(() => devices.id, { onDelete: "set null" }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  severity: text("severity").default("info"), // info, warning, danger
}, (table) => [
  index("activity_logs_user_id_idx").on(table.userId),
  index("activity_logs_created_at_idx").on(table.createdAt),
  index("activity_logs_app_id_idx").on(table.appId),
  index("activity_logs_user_created_at_idx").on(table.userId, table.createdAt),
]);

export const appAnalyticsEvents = sqliteTable("app_analytics_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  appId: text("app_id").references(() => oauthApps.id, { onDelete: "cascade" }).notNull(),
  identityId: text("identity_id").references(() => identities.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  authMethod: text("auth_method"),
  severity: text("severity").default("info").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
}, (table) => [
  index("app_analytics_events_app_id_idx").on(table.appId),
  index("app_analytics_events_created_at_idx").on(table.createdAt),
  index("app_analytics_events_identity_id_idx").on(table.identityId),
  index("app_analytics_events_event_type_idx").on(table.eventType),
  index("app_analytics_events_app_created_at_idx").on(table.appId, table.createdAt),
]);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type AppAnalyticsEvent = typeof appAnalyticsEvents.$inferSelect;
