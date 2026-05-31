import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for server-side database access.");
  }

  return process.env.DATABASE_URL;
}

const sql = neon(getDatabaseUrl());

export const db = drizzle(sql, { schema });
