import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { loadNeonMainUrls } from "./scripts/production-target";

if (process.env.NODE_ENV === "production") {
  Object.assign(process.env, loadNeonMainUrls());
} else {
  loadEnvConfig(process.cwd(), true);
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
});
