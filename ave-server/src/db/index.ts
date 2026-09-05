import { drizzle } from "drizzle-orm/d1";
import { AsyncLocalStorage } from "node:async_hooks";
import * as businessSchema from "./business-schema";
import * as baseSchema from "./schema";

const schema = { ...baseSchema, ...businessSchema };

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

function databaseProxy(resolve: () => DrizzleDb): DrizzleDb {
  return new Proxy({} as DrizzleDb, {
    get(_target, prop) {
      const instance = resolve() as unknown as Record<PropertyKey, unknown>;
      const value = instance[prop];
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
}

export const db = databaseProxy(getDbInstance);

export const primaryDb = databaseProxy(() => {
  if (!baseBoundDatabase) throw new Error("DB is not initialized. Call initDb(env.DB) before using primaryDb.");
  return createDb((baseBoundDatabase as D1Database).withSession("first-primary"));
});

export * from "./business-schema";
export * from "./schema";
