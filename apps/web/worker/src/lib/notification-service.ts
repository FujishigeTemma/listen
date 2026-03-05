import type { EmailQueueMessage } from "@listen/mailer";

import { notificationTokens, notifications, users } from "@listen/db";
import { createToken, hashToken } from "@listen/shared";
import dayjs from "dayjs";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import * as v from "valibot";

import type { DB } from "./db";

const TOKEN_TTL_SECONDS = 30 * 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_DAILY_SECONDS = 24 * 60 * 60;
const RATE_LIMIT_PER_MINUTE = 1;
const RATE_LIMIT_PER_DAY = 5;

const emailSchema = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email());

function normalizeEmail(email: string) {
  return v.parse(emailSchema, email);
}

function nowUnix() {
  return dayjs().unix();
}

async function countTokens(db: DB, where: ReturnType<typeof and> | ReturnType<typeof eq>) {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notificationTokens)
    .where(where);
  return Number(row?.count ?? 0);
}

async function enforceSubscribeRateLimit(db: DB, email: string, ip: string) {
  const now = nowUnix();
  const oneMinuteAgo = now - RATE_LIMIT_WINDOW_SECONDS;
  const oneDayAgo = now - RATE_LIMIT_DAILY_SECONDS;

  const countPerMinute = await countTokens(
    db,
    and(
      eq(notificationTokens.purpose, "subscribe_verify"),
      eq(notificationTokens.email, email),
      eq(notificationTokens.requestIp, ip),
      gt(notificationTokens.createdAt, oneMinuteAgo),
    ),
  );

  if (countPerMinute >= RATE_LIMIT_PER_MINUTE) {
    return false;
  }

  const countPerDay = await countTokens(
    db,
    and(
      eq(notificationTokens.purpose, "subscribe_verify"),
      eq(notificationTokens.email, email),
      gt(notificationTokens.createdAt, oneDayAgo),
    ),
  );

  return countPerDay < RATE_LIMIT_PER_DAY;
}

async function storeToken(
  db: DB,
  email: string,
  purpose: "subscribe_verify" | "unsubscribe",
  requestIp: string,
  expiresAt: number,
) {
  const token = createToken();
  const tokenHash = await hashToken(token);
  await db.insert(notificationTokens).values({
    email,
    tokenHash,
    purpose,
    requestIp,
    expiresAt,
    createdAt: nowUnix(),
  });
  return token;
}

async function consumeToken(
  db: DB,
  token: string,
  purpose: "subscribe_verify" | "unsubscribe",
) {
  const tokenHash = await hashToken(token);
  const now = nowUnix();

  const record = await db.query.notificationTokens.findFirst({
    where: and(
      eq(notificationTokens.tokenHash, tokenHash),
      eq(notificationTokens.purpose, purpose),
      isNull(notificationTokens.consumedAt),
      gt(notificationTokens.expiresAt, now),
    ),
  });

  if (!record) return undefined;

  await db
    .update(notificationTokens)
    .set({ consumedAt: now })
    .where(eq(notificationTokens.id, record.id));

  return record;
}

async function findOrCreateUserByEmail(db: DB, email: string) {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) return existing;

  const now = nowUnix();
  const [created] = await db
    .insert(users)
    .values({
      email,
      clerkUserId: undefined,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  if (!created) {
    return await db.query.users.findFirst({
      where: eq(users.email, email),
    });
  }

  return created;
}

export async function enableNotificationForUser(db: DB, userId: number) {
  const existing = await db.query.notifications.findFirst({
    where: eq(notifications.userId, userId),
  });

  if (existing) return false;

  const now = nowUnix();
  await db.insert(notifications).values({
    userId,
    createdAt: now,
    updatedAt: now,
  });
  return true;
}

export async function disableNotificationForUser(db: DB, userId: number) {
  await db.delete(notifications).where(eq(notifications.userId, userId));
}

export async function requestNotificationVerificationByEmail(
  db: DB,
  email: string,
  requestIp: string,
  publicUrl: string,
  queue: Queue<EmailQueueMessage>,
) {
  const normalizedEmail = normalizeEmail(email);
  const allowed = await enforceSubscribeRateLimit(db, normalizedEmail, requestIp);
  if (!allowed) {
    return { ok: false as const, reason: "rate_limited" as const };
  }

  const token = await storeToken(db, normalizedEmail, "subscribe_verify", requestIp, nowUnix() + TOKEN_TTL_SECONDS);

  const verifyUrl = new URL("/notifications/verify", publicUrl);
  verifyUrl.searchParams.set("token", token);

  await queue.send({
    type: "subscribe_verify",
    email: normalizedEmail,
    verifyUrl: verifyUrl.toString(),
  });

  return { ok: true as const };
}

export async function verifySubscriptionToken(db: DB, token: string) {
  const record = await consumeToken(db, token, "subscribe_verify");
  if (!record) return false;

  try {
    const user = await findOrCreateUserByEmail(db, record.email);
    if (!user) return false;
    await enableNotificationForUser(db, user.id);
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeByToken(db: DB, token: string) {
  const record = await consumeToken(db, token, "unsubscribe");
  if (!record) return false;

  const user = await db.query.users.findFirst({
    where: eq(users.email, record.email),
  });
  if (!user) return true;

  await disableNotificationForUser(db, user.id);
  return true;
}
