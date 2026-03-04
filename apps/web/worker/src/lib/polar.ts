import type { DB } from "./db";
import { users, subscriptions } from "@listen/db";
import type { Subscription as PolarSubscription } from "@polar-sh/sdk/models/components/subscription";
import { eq } from "drizzle-orm";

function toUnixTimestamp(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.floor(date.getTime() / 1000);
}

export type SubscriptionStatus = "active" | "canceled" | "past_due" | "unpaid" | "incomplete" | "trialing" | "revoked";

async function upsertSubscription(
  db: DB,
  userId: number,
  data: {
    polarSubscriptionId: string;
    polarProductId: string;
    status: SubscriptionStatus;
    currentPeriodStart: number | null;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
  },
) {
  const now = Math.floor(Date.now() / 1000);
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.polarSubscriptionId, data.polarSubscriptionId),
  });

  if (existing) {
    await db
      .update(subscriptions)
      .set({
        status: data.status,
        currentPeriodStart: data.currentPeriodStart ?? existing.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd ?? existing.currentPeriodEnd,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        updatedAt: now,
      })
      .where(eq(subscriptions.polarSubscriptionId, data.polarSubscriptionId));
  } else {
    await db.insert(subscriptions).values([{
      userId,
      polarSubscriptionId: data.polarSubscriptionId,
      polarProductId: data.polarProductId,
      status: data.status,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      createdAt: now,
      updatedAt: now,
    }]);
  }
}

/**
 * Process a subscription webhook event.
 * Requires that the user already exists with a clerk_user_id.
 * The user is looked up by email (which was set during Clerk sync).
 */
export async function handleSubscriptionEvent(
  db: DB,
  sub: PolarSubscription,
  status: SubscriptionStatus,
) {
  const email = sub.customer.email;
  const polarCustomerId = sub.customer.id;

  // User must already exist (created via Clerk login + /me/sync).
  // We do NOT create users from webhooks — Clerk login is required first.
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user?.clerkUserId) return;

  // Link polarCustomerId if not already set
  if (!user.polarCustomerId) {
    await db
      .update(users)
      .set({ polarCustomerId, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(users.id, user.id));
  }

  await upsertSubscription(db, user.id, {
    polarSubscriptionId: sub.id,
    polarProductId: sub.productId,
    status,
    currentPeriodStart: toUnixTimestamp(sub.currentPeriodStart),
    currentPeriodEnd: toUnixTimestamp(sub.currentPeriodEnd),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  });
}
