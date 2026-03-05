import {
  notificationDeliveries,
  notificationEvents,
  notificationTokens,
  notifications,
  sessions,
  users,
} from "@listen/db";
import dayjs from "dayjs";
import { and, eq, isNotNull, lt, or, sql } from "drizzle-orm";
import { createDB } from '../lib/db.ts';
import type { DB } from '../lib/db.ts';
import type { Env } from "../lib/types.ts";

function eventKey(type: "live_started" | "scheduled_created", sessionId: string) {
  return `${type}:${sessionId}`;
}

async function createEvent(
  db: DB,
  eventType: "live_started" | "scheduled_created",
  sessionId: string,
  sessionState: "scheduled" | "live" | "ended",
  occurredAt: number,
) {
  const now = dayjs().unix();
  const [event] = await db
    .insert(notificationEvents)
    .values({
      eventKey: eventKey(eventType, sessionId),
      eventType,
      sessionId,
      sessionState,
      occurredAt,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: notificationEvents.id });

  return event?.id;
}

async function createDeliveriesForEvent(db: DB, eventId: number) {
  const subscribers = await db
    .select({
      userId: users.id,
      email: users.email,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id));

  if (subscribers.length === 0) return [];

  const now = dayjs().unix();
  const deliveryRows = subscribers.map((subscriber) => ({
    eventId,
    userId: subscriber.userId,
    email: subscriber.email,
    status: "queued" as const,
    attemptCount: 0,
    queuedAt: now,
    createdAt: now,
    updatedAt: now,
  }));

  const deliveries = await db
    .insert(notificationDeliveries)
    .values(deliveryRows)
    .onConflictDoNothing()
    .returning({ id: notificationDeliveries.id });

  return deliveries.map((delivery) => delivery.id);
}

async function enqueueDeliveries(env: Env, deliveryIds: number[]) {
  const results = await Promise.allSettled(
    deliveryIds.map((deliveryId) =>
      env.NOTIFICATION_EMAIL_QUEUE.send({ type: "notification_delivery", deliveryId }),
    ),
  );

  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      console.error("Failed to enqueue delivery", {
        deliveryId: deliveryIds[index],
        error: String(result.reason),
      });
    }
  }
}

async function processSessionEvent(
  db: DB,
  env: Env,
  eventType: "live_started" | "scheduled_created",
  session: { id: string; state: "scheduled" | "live" | "ended" },
  occurredAt: number,
) {
  const eventId = await createEvent(db, eventType, session.id, session.state, occurredAt);
  if (!eventId) return { events: 0, deliveries: 0 };

  const deliveryIds = await createDeliveriesForEvent(db, eventId);
  await enqueueDeliveries(env, deliveryIds);
  return { events: 1, deliveries: deliveryIds.length };
}

async function processSessionsOfType(
  db: DB,
  env: Env,
  state: "live" | "scheduled",
  eventType: "live_started" | "scheduled_created",
  getOccurredAt: (session: { startedAt: number | null; scheduledAt: number | null }) => number,
) {
  const sessionList = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.state, state),
        state === "live" ? isNotNull(sessions.startedAt) : isNotNull(sessions.scheduledAt),
        sql`NOT EXISTS (SELECT 1 FROM ${notificationEvents} WHERE ${notificationEvents.eventKey} = ${eventType} || ':' || ${sessions.id})`,
      ),
    );

  let events = 0;
  let deliveries = 0;
  for (const session of sessionList) {
    const result = await processSessionEvent(db, env, eventType, session, getOccurredAt(session));
    events += result.events;
    deliveries += result.deliveries;
  }
  return { events, deliveries };
}

async function detectAndQueueEvents(env: Env) {
  const db = createDB(env.DB);
  const now = dayjs().unix();
  const live = await processSessionsOfType(db, env, "live", "live_started", (s) => s.startedAt ?? now);
  const scheduled = await processSessionsOfType(db, env, "scheduled", "scheduled_created", (s) => s.scheduledAt ?? now);
  return {
    createdEventCount: live.events + scheduled.events,
    queuedDeliveryCount: live.deliveries + scheduled.deliveries,
  };
}

async function cleanupStaleRecords(env: Env) {
  const db = createDB(env.DB);
  const now = dayjs().unix();

  await db
    .delete(notificationTokens)
    .where(
      or(
        isNotNull(notificationTokens.consumedAt),
        lt(notificationTokens.expiresAt, now),
      ),
    );

  const ninetyDaysAgo = now - 90 * 86_400;
  await db
    .delete(notificationDeliveries)
    .where(
      and(
        eq(notificationDeliveries.status, "failed"),
        lt(notificationDeliveries.createdAt, ninetyDaysAgo),
      ),
    );

  const tenMinutesAgo = now - 600;
  await db
    .update(notificationDeliveries)
    .set({ status: "failed", lastError: "Stuck in processing", updatedAt: now })
    .where(
      and(
        eq(notificationDeliveries.status, "processing"),
        lt(notificationDeliveries.updatedAt, tenMinutesAgo),
      ),
    );
}

export async function handleScheduled(env: Env) {
  const result = await detectAndQueueEvents(env);
  console.log("Email worker scheduled run", result);
  await cleanupStaleRecords(env);
}
