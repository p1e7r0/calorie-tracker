import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDatabase = globalThis as unknown as { databasePool?: Pool };

const pool =
  globalForDatabase.databasePool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.databasePool = pool;
}

attachDatabasePool(pool);

export const database = drizzle({ client: pool, schema, casing: "snake_case" });

export type Database = typeof database;
