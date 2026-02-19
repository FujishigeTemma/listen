import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "@listen/db";
import { drizzle } from "drizzle-orm/d1";


export function createDB(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type DB = ReturnType<typeof createDB>;
