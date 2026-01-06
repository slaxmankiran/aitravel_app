import * as schema from "@shared/schema";

// Support both Postgres (when DATABASE_URL is set) and a local SQLite
// fallback for development so the app can run without a provisioned
// Postgres instance (useful for local runs).

// Postgres imports
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// SQLite (better-sqlite3) imports for local dev
import Database from "better-sqlite3";
import { drizzle as sqliteDrizzle } from "drizzle-orm/better-sqlite3";

const { Pool } = pg;

let _pool: any = undefined;
let _db: any = undefined;

if (process.env.DATABASE_URL) {
  // Production / explicit DB URL (Postgres)
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
  _db = pgDrizzle(_pool, { schema });
} else {
  // Development fallback: use a local SQLite file `dev.db` by default.
  // You can override the file path with SQLITE_DB_PATH env var.
  const sqlitePath = process.env.SQLITE_DB_PATH || "./dev.db";
  const sqlite = new Database(sqlitePath);
  _db = sqliteDrizzle(sqlite, { schema });
}

export const pool: any = _pool;
export const db: any = _db;
