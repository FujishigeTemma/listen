import { emailSuppressions, notificationDeliveries } from "@listen/db";
import dayjs from "dayjs";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import type { DB } from "./db.ts";
import type { Env } from "./types.ts";

export const MAX_ATTEMPTS = 3;

export function retryDelaySeconds(attemptCount: number) {
  return 60 * 2 ** Math.max(0, attemptCount - 1);
}

export async function claimDelivery(db: DB, deliveryId: number) {
  const now = dayjs().unix();
  const [delivery] = await db
    .update(notificationDeliveries)
    .set({
      status: "processing",
      attemptCount: sql`${notificationDeliveries.attemptCount} + 1`,
      updatedAt: now,
      lastError: undefined,
    })
    .where(
      and(
        eq(notificationDeliveries.id, deliveryId),
        eq(notificationDeliveries.status, "queued"),
        or(
          isNull(notificationDeliveries.nextRetryAt),
          lte(notificationDeliveries.nextRetryAt, now),
        ),
      ),
    )
    .returning({
      id: notificationDeliveries.id,
      eventId: notificationDeliveries.eventId,
      email: notificationDeliveries.email,
      attemptCount: notificationDeliveries.attemptCount,
    });
  return delivery;
}

export async function markDeliverySent(db: DB, deliveryId: number) {
  const now = dayjs().unix();
  await db
    .update(notificationDeliveries)
    .set({
      status: "sent",
      sentAt: now,
      nextRetryAt: undefined,
      lastError: undefined,
      updatedAt: now,
    })
    .where(eq(notificationDeliveries.id, deliveryId));
}

export async function markDeliveryFailed(db: DB, deliveryId: number, errorMessage: string) {
  await db
    .update(notificationDeliveries)
    .set({
      status: "failed",
      lastError: errorMessage,
      updatedAt: dayjs().unix(),
    })
    .where(eq(notificationDeliveries.id, deliveryId));
}

export async function retryOrFailDelivery(
  env: Env,
  db: DB,
  delivery: { id: number; attemptCount: number },
  error: string,
) {
  if (delivery.attemptCount >= MAX_ATTEMPTS) {
    await markDeliveryFailed(db, delivery.id, error);
    return;
  }

  const delaySeconds = retryDelaySeconds(delivery.attemptCount);
  await db
    .update(notificationDeliveries)
    .set({
      status: "queued",
      nextRetryAt: dayjs().unix() + delaySeconds,
      lastError: error,
      updatedAt: dayjs().unix(),
    })
    .where(eq(notificationDeliveries.id, delivery.id));

  await env.NOTIFICATION_EMAIL_QUEUE.send(
    { type: "notification_delivery", deliveryId: delivery.id },
    { delaySeconds },
  );
}

export async function checkSuppression(db: DB, deliveryId: number, email: string) {
  const suppression = await db.query.emailSuppressions.findFirst({
    where: eq(emailSuppressions.email, email),
  });
  if (suppression) {
    await markDeliveryFailed(db, deliveryId, `suppressed: ${suppression.reason}`);
    return true;
  }
  return false;
}
