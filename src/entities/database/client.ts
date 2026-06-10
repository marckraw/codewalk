import "server-only";

import { drizzle } from "drizzle-orm/neon-serverless";
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
  return drizzle(getDatabaseUrl(), { schema });
}

export function getDb() {
  cachedDb ??= createDatabaseClient();
  return cachedDb;
}
