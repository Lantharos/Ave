import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const ephemeralChallenges = sqliteTable("ephemeral_challenges", {
  id: text("id").primaryKey(),
  namespace: text("namespace").notNull(),
  challengeKey: text("challenge_key").notNull(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("ephemeral_challenges_namespace_key_unique").on(table.namespace, table.challengeKey),
  index("ephemeral_challenges_expires_at_idx").on(table.expiresAt),
]);
