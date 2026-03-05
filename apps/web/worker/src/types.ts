import type { EmailQueueMessage } from "@listen/mailer";

export interface Variables {
  userId?: number;
  userEmail?: string;
  isPremium?: boolean;
}

/** Secrets set via `wrangler secret put`. */
declare global {
  interface Env {
    CLERK_SECRET_KEY?: string;
    CLERK_PUBLISHABLE_KEY?: string;
    CLERK_WEBHOOK_SIGNING_SECRET?: string;
    NOTIFICATION_EMAIL_QUEUE: Queue<EmailQueueMessage>;
    POLAR_ACCESS_TOKEN?: string;
    POLAR_WEBHOOK_SECRET?: string;
    POLAR_PRODUCT_ID?: string;
  }
}
