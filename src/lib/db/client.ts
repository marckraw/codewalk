import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

let cachedDb: DatabaseClient | null = null;

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for server-side database access.");
  }

  return process.env.DATABASE_URL;
}

function createDatabaseClient() {
  const sql = neon(getDatabaseUrl());
  return drizzle(sql, { schema });
}

export function getDb() {
  cachedDb ??= createDatabaseClient();
  return cachedDb;
}
