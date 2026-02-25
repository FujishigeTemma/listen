import type { D1Database, Fetcher, R2Bucket } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  ASSETS: Fetcher;
  PUBLIC_URL: string;
}

export interface Variables {
  userId?: string;
  userEmail?: string;
  isPremium?: boolean;
}
