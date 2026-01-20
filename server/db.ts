import * as schema from "@shared/schema";

// PostgreSQL (Supabase) - Required for all environments
// No fallback to SQLite or in-memory storage

import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const { Pool } = pg;

// Enforce DATABASE_URL requirement
if (!process.env.DATABASE_URL) {
  console.error("[DB] ERROR: DATABASE_URL environment variable is required.");
  console.error("[DB] Please set DATABASE_URL in your .env file or environment.");
  console.error("[DB] Example: DATABASE_URL=\"postgresql://user:pass@host:5432/db\"");
  process.exit(1);
}

console.log(`[DB] Using PostgreSQL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);

const _pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Supabase
});

const _db = pgDrizzle(_pool, { schema });

export const pool = _pool;
export const db = _db;
