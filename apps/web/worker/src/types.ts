import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  PUBLIC_URL: string;
}

export interface Variables {
  userId?: string;
  userEmail?: string;
  isPremium?: boolean;
}
