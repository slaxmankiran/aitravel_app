import { defineConfig } from "drizzle-kit";

// Support running migrations against a local SQLite file when
// DATABASE_URL is not provided (useful for local development).
const sqlitePath = process.env.SQLITE_DB_PATH || "./dev.db";

const cfg = process.env.DATABASE_URL
  ? {
      out: "./migrations",
      schema: ["./shared/schema.ts", "./shared/knowledgeSchema.ts"],
      dialect: "postgresql",
      dbCredentials: { url: process.env.DATABASE_URL },
    }
  : {
      out: "./migrations",
      schema: "./shared/schema.ts", // SQLite doesn't support pgvector
      dialect: "sqlite",
      dbCredentials: { url: `file:${sqlitePath}` },
    };

export default defineConfig(cfg as any);
