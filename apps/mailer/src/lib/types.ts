export type EmailQueueMessage =
  | { type: "notification_delivery"; deliveryId: number }
  | { type: "subscribe_verify"; email: string; verifyUrl: string }
  | { type: "transactional"; to: string; subject: string; html: string; text: string };

export interface Env {
  DB: D1Database;
  NOTIFICATION_EMAIL_QUEUE: Queue<EmailQueueMessage>;
  PUBLIC_URL: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_WEBHOOK_SECRET?: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}
