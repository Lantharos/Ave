import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle> | null = null;
let postgresClient: ReturnType<typeof postgres> | null = null;

function getDbInstance(): ReturnType<typeof drizzle> {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  postgresClient = postgres(connectionString);
  dbInstance = drizzle(postgresClient, { schema });
  return dbInstance;
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
