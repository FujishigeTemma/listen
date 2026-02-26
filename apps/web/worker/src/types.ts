export interface Variables {
  userId?: string;
  userEmail?: string;
  isPremium?: boolean;
}

/** Secrets set via `wrangler secret put` (not in wrangler.jsonc). */
declare global {
  interface Env {
    CLERK_SECRET_KEY?: string;
  }
}
