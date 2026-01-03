import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use the Replit-provided DATABASE_URL directly
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Ensure the database is provisioned in the Replit Database tool.",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});
export const db = drizzle(pool, { schema });
