import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as schema from "@listen/db";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, "../../../../../packages/db/drizzle");

export function createDB(dbPath: string) {
  const sqlite = new Database(resolve(dbPath));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });

  return db;
}

export type DB = ReturnType<typeof createDB>;
