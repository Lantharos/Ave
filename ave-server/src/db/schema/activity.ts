import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { devices, users } from "./accounts";
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

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
