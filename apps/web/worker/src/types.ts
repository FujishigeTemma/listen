export interface Variables {
  userId?: string;
  userEmail?: string;
  isPremium?: boolean;
}

/** Secrets set via `wrangler secret put`. */
declare global {
  interface Env {
    CLERK_SECRET_KEY?: string;
    CLERK_PUBLISHABLE_KEY?: string;
  }
}
