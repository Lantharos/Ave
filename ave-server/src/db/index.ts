import { drizzle } from "drizzle-orm/d1";
import { AsyncLocalStorage } from "node:async_hooks";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle>;

let baseDbInstance: DrizzleDb | null = null;
let baseBoundDatabase: unknown = null;
const dbScope = new AsyncLocalStorage<DrizzleDb>();

function createDb(database: unknown): DrizzleDb {
  if (!database) {
    throw new Error("DB binding is not configured");
  }

  return drizzle(database as any, { schema });
}

export function initDb(database: unknown): void {
  if (baseDbInstance && baseBoundDatabase === database) {
    return;
  }

  baseDbInstance = createDb(database);
  baseBoundDatabase = database;
}

export function runWithDb<T>(database: unknown, callback: () => T): T {
  const scopedDb = createDb(database);
  return dbScope.run(scopedDb, callback);
}

function getDbInstance(): DrizzleDb {
  const scoped = dbScope.getStore();
  if (scoped) return scoped;

  if (!baseDbInstance) {
    throw new Error("DB is not initialized. Call initDb(env.DB) before using db.");
  }

  return baseDbInstance;
}

// Lazily initialize database connection at request/runtime, not module import time.
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const instance = getDbInstance() as unknown as Record<PropertyKey, unknown>;
    const value = instance[prop];
    if (typeof value === "function") {
      return (value as Function).bind(instance);
    }
    return value;
  },
});

export * from "./schema";
