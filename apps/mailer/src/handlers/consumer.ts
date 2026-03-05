import { notificationEvents, notificationTokens } from "@listen/db";
import { createToken, hashToken } from "@listen/shared";
import { render } from "@react-email/components";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import type { DB } from "../lib/db.ts";
import { createDB } from "../lib/db.ts";
import {
  checkSuppression,
  claimDelivery,
  markDeliveryFailed,
  markDeliverySent,
  retryOrFailDelivery,
} from "../lib/delivery.ts";
import { sendEmail } from "../lib/resend.ts";
import type { EmailPayload, EmailQueueMessage, Env } from "../lib/types.ts";
import {
  NotificationEmail,
  notificationSubject,
} from "../emails/notification-email.tsx";
import {
  VerificationEmail,
  verificationSubject,
} from "../emails/verification-email.tsx";

import dayjsTimezone from "dayjs/plugin/timezone";
import dayjsUtc from "dayjs/plugin/utc";

dayjs.extend(dayjsUtc); // eslint-disable-line vitest/require-hook
dayjs.extend(dayjsTimezone); // eslint-disable-line vitest/require-hook

const UNSUBSCRIBE_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

interface QueueContext {
  db: DB;
  env: Env;
  resend: Resend;
  from: string;
}

// ---------------------------------------------------------------------------
// Email rendering
// ---------------------------------------------------------------------------

function formatJst(unixSeconds: number) {
  return dayjs.unix(unixSeconds).tz("Asia/Tokyo").format("YYYY/MM/DD HH:mm");
}

async function renderNotificationContent(
  eventType: "live_started" | "scheduled_created",
  sessionId: string,
  occurredAt: number,
  publicUrl: string,
  unsubscribeUrl: string,
) {
  // eslint-disable-next-line new-cap
  const element = NotificationEmail({
    eventType,
    sessionId,
    occurredAt: formatJst(occurredAt),
    publicUrl,
    unsubscribeUrl,
  });

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return { subject: notificationSubject(eventType), html, text };
}

async function renderVerificationEmail(verifyUrl: string) {
  // eslint-disable-next-line new-cap
  const element = VerificationEmail({ verifyUrl });

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return { subject: verificationSubject, html, text };
}

// ---------------------------------------------------------------------------
// Unsubscribe token & headers
// ---------------------------------------------------------------------------

async function createUnsubscribeToken(db: DB, email: string) {
  const token = createToken();
  const tokenHash = await hashToken(token);
  const now = dayjs().unix();

  await db.insert(notificationTokens).values({
    email,
    tokenHash,
    purpose: "unsubscribe",
    requestIp: "system:mailer",
    expiresAt: now + UNSUBSCRIBE_TOKEN_TTL_SECONDS,
    createdAt: now,
  });

  return token;
}

function buildUnsubscribeUrl(publicUrl: string, token: string) {
  const url = new URL("/notifications", publicUrl);
  url.searchParams.set("unsubscribeToken", token);
  return url.toString();
}

function buildListUnsubscribeHeaders(publicUrl: string, token: string): Record<string, string> {
  const url = new URL("/notifications/unsubscribe/one-click", publicUrl);
  url.searchParams.set("unsubscribeToken", token);
  return {
    "List-Unsubscribe": `<${url.toString()}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// ---------------------------------------------------------------------------
// Delivery preparation
// ---------------------------------------------------------------------------

async function prepareDelivery(
  db: DB,
  env: Env,
  deliveryId: number,
): Promise<{ delivery: { id: number; attemptCount: number }; payload: EmailPayload; headers: Record<string, string> } | undefined> {
  const delivery = await claimDelivery(db, deliveryId);
  if (!delivery) return undefined;

  if (await checkSuppression(db, delivery.id, delivery.email)) return undefined;

  const event = await db.query.notificationEvents.findFirst({
    where: eq(notificationEvents.id, delivery.eventId),
  });
  if (!event) {
    await markDeliveryFailed(db, delivery.id, "Event not found");
    return undefined;
  }

  const unsubscribeToken = await createUnsubscribeToken(db, delivery.email);
  const content = await renderNotificationContent(
    event.eventType,
    event.sessionId,
    event.occurredAt,
    env.PUBLIC_URL,
    buildUnsubscribeUrl(env.PUBLIC_URL, unsubscribeToken),
  );

  return {
    delivery: { id: delivery.id, attemptCount: delivery.attemptCount },
    payload: { to: delivery.email, ...content },
    headers: buildListUnsubscribeHeaders(env.PUBLIC_URL, unsubscribeToken),
  };
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

function handleSendResult(message: Message<EmailQueueMessage>, result: { ok: boolean; error?: string; retryable?: boolean }, label: string) {
  if (result.ok) {
    message.ack();
  } else if (result.retryable) {
    message.retry();
  } else {
    console.error(`Non-retryable ${label} error`, { error: result.error });
    message.ack();
  }
}

async function handleDeliverySendResult(
  ctx: QueueContext,
  message: Message<EmailQueueMessage>,
  delivery: { id: number; attemptCount: number },
  result: { ok: boolean; error?: string; retryable?: boolean },
) {
  if (result.ok) {
    await markDeliverySent(ctx.db, delivery.id);
    message.ack();
  } else if (result.retryable) {
    await retryOrFailDelivery(ctx.env, ctx.db, delivery, result.error ?? "Unknown error");
    message.retry();
  } else {
    await markDeliveryFailed(ctx.db, delivery.id, result.error ?? "Unknown error");
    message.ack();
  }
}

async function handleDeliveryMessage(ctx: QueueContext, message: Message<EmailQueueMessage>, deliveryId: number) {
  const prepared = await prepareDelivery(ctx.db, ctx.env, deliveryId);
  if (!prepared) {
    message.ack();
    return;
  }

  const result = await sendEmail(ctx.resend, ctx.from, prepared.payload, `delivery/${prepared.delivery.id}`, prepared.headers);

  await handleDeliverySendResult(ctx, message, prepared.delivery, result);
}

async function handleSubscribeVerifyMessage(ctx: QueueContext, message: Message<EmailQueueMessage>, body: Extract<EmailQueueMessage, { type: "subscribe_verify" }>) {
  const content = await renderVerificationEmail(body.verifyUrl);
  const tokenHash = new URL(body.verifyUrl).searchParams.get("token") ?? message.id;
  const result = await sendEmail(ctx.resend, ctx.from, { to: body.email, ...content }, `subscribe-verify/${tokenHash}`);
  handleSendResult(message, result, "subscribe_verify");
}

async function handleTransactionalMessage(ctx: QueueContext, message: Message<EmailQueueMessage>, body: Extract<EmailQueueMessage, { type: "transactional" }>) {
  const result = await sendEmail(ctx.resend, ctx.from, { to: body.to, subject: body.subject, html: body.html, text: body.text }, `transactional/${message.id}`);
  handleSendResult(message, result, "transactional");
}

async function processMessage(ctx: QueueContext, message: Message<EmailQueueMessage>) {
  const { body } = message;
  if (body.type === "notification_delivery") {
    await handleDeliveryMessage(ctx, message, body.deliveryId);
  } else if (body.type === "subscribe_verify") {
    await handleSubscribeVerifyMessage(ctx, message, body);
  } else if (body.type === "transactional") {
    await handleTransactionalMessage(ctx, message, body);
  } else {
    message.ack();
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function handleQueue(batch: MessageBatch<EmailQueueMessage>, env: Env) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error("Resend is not configured");
  }

  const ctx: QueueContext = {
    db: createDB(env.DB),
    env,
    resend: new Resend(env.RESEND_API_KEY),
    from: env.RESEND_FROM_EMAIL,
  };

  for (const message of batch.messages) {
    await processMessage(ctx, message);
  }
}
