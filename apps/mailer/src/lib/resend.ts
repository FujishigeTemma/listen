import type { Resend } from "resend";
import type { EmailPayload } from "./types.ts";

export async function sendEmail(
  resend: Resend,
  from: string,
  payload: EmailPayload,
  idempotencyKey: string,
  headers?: Record<string, string>,
) {
  const { error } = await resend.emails.send(
    { from, to: [payload.to], subject: payload.subject, text: payload.text, html: payload.html, headers },
    { idempotencyKey },
  );
  if (!error) return { ok: true as const };
  const retryable = error.name === "rate_limit_exceeded" || error.name === "internal_server_error";
  return { ok: false as const, error: error.message, retryable };
}
