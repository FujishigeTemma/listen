import { emailSuppressions, notifications, users } from "@listen/db";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { Webhook } from "svix";
import { createDB } from "../lib/db.ts";
import type { Env } from "../lib/types.ts";

interface ResendWebhookEvent {
  type: string;
  data: {
    to?: string[];
    email_id?: string;
  };
}

function parseWebhookEvent(payload: unknown): ResendWebhookEvent | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const obj = payload as Record<string, unknown>; // eslint-disable-line typescript-eslint/no-unsafe-type-assertion
  if (typeof obj.type !== "string") return undefined;
  const data = typeof obj.data === "object" && obj.data !== null ? obj.data as Record<string, unknown> : {}; // eslint-disable-line typescript-eslint/no-unsafe-type-assertion
  const to = Array.isArray(data.to) ? data.to.filter((v): v is string => typeof v === "string") : undefined;
  const emailId = typeof data.email_id === "string" ? data.email_id : undefined;
  return { type: obj.type, data: { to, email_id: emailId } };
}

function verifyWebhookSignature(request: Request, body: string, secret: string): ResendWebhookEvent | undefined {
  const wh = new Webhook(secret);
  try {
    const payload = wh.verify(body, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    });
    return parseWebhookEvent(payload);
  } catch {
    return undefined;
  }
}

async function addSuppression(db: ReturnType<typeof createDB>, email: string, reason: "hard_bounce" | "complaint", sourceEmailId?: string) {
  await db
    .insert(emailSuppressions)
    .values({ email, reason, sourceEmailId, createdAt: dayjs().unix() })
    .onConflictDoNothing();
}

async function handleWebhookEvent(db: ReturnType<typeof createDB>, event: ResendWebhookEvent) {
  const to = event.data.to?.[0];
  if (!to) return;

  if (event.type === "email.bounced") {
    await addSuppression(db, to, "hard_bounce", event.data.email_id);
  } else if (event.type === "email.complained") {
    await addSuppression(db, to, "complaint", event.data.email_id);
    const user = await db.query.users.findFirst({ where: eq(users.email, to) });
    if (user) {
      await db.delete(notifications).where(eq(notifications.userId, user.id));
    }
  }
}

export async function handleResendWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.RESEND_WEBHOOK_SECRET) {
    return new Response("Webhook secret not configured", { status: 503 });
  }

  const body = await request.text();
  const event = verifyWebhookSignature(request, body, env.RESEND_WEBHOOK_SECRET);
  if (!event) return new Response("Invalid signature", { status: 401 });

  await handleWebhookEvent(createDB(env.DB), event);
  return new Response("ok");
}
