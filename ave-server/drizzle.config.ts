import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/db/schema.ts", "./src/db/business-schema.ts"],
  out: "./drizzle",
  dialect: "sqlite",
});
