import type { DB } from "./db";
import { users, subscriptions } from "@listen/db";
import { Polar } from "@polar-sh/sdk";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { eq } from "drizzle-orm";

export { WebhookVerificationError };

export function createPolar(env: Env): Polar {
  return new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN ?? "",
  });
}

async function findOrCreateUserByEmail(db: DB, email: string): Promise<number> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) return existing.id;

  const now = Math.floor(Date.now() / 1000);
  const [inserted] = await db
    .insert(users)
    .values({ email, createdAt: now, updatedAt: now })
    .returning({ id: users.id });
  return inserted.id;
}

async function upsertSubscription(
  db: DB,
  userId: number,
  data: {
    polarSubscriptionId: string;
    polarProductId: string;
    status: string;
    currentPeriodStart?: number | null;
    currentPeriodEnd?: number | null;
    cancelAtPeriodEnd?: boolean;
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
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? existing.cancelAtPeriodEnd,
        updatedAt: now,
      })
      .where(eq(subscriptions.polarSubscriptionId, data.polarSubscriptionId));
  } else {
    await db.insert(subscriptions).values({
      userId,
      polarSubscriptionId: data.polarSubscriptionId,
      polarProductId: data.polarProductId,
      status: data.status,
      currentPeriodStart: data.currentPeriodStart ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function toUnixTimestamp(dateString: string | undefined | null): number | null {
  if (!dateString) return null;
  const d = new Date(dateString);
  return Number.isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
}

export async function handleWebhookEvent(
  body: string,
  headers: Record<string, string>,
  webhookSecret: string,
  db: DB,
) {
  const event = validateEvent(body, headers, webhookSecret);

  const type = event.type as string;

  if (
    type === "subscription.created" ||
    type === "subscription.updated" ||
    type === "subscription.active" ||
    type === "subscription.canceled" ||
    type === "subscription.revoked" ||
    type === "subscription.uncanceled"
  ) {
    const sub = event.data as Record<string, unknown>;
    const customer = sub.customer as Record<string, unknown> | undefined;
    const email = (customer?.email as string) ?? "";
    const polarCustomerId = customer?.id as string | undefined;

    if (!email) return;

    const userId = await findOrCreateUserByEmail(db, email);

    if (polarCustomerId) {
      await db
        .update(users)
        .set({ polarCustomerId, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(users.id, userId));
    }

    const statusMap: Record<string, string> = {
      "subscription.created": "active",
      "subscription.active": "active",
      "subscription.updated": sub.status as string,
      "subscription.canceled": "canceled",
      "subscription.revoked": "revoked",
      "subscription.uncanceled": "active",
    };

    await upsertSubscription(db, userId, {
      polarSubscriptionId: sub.id as string,
      polarProductId: sub.productId as string,
      status: statusMap[type] ?? (sub.status as string),
      currentPeriodStart: toUnixTimestamp(sub.currentPeriodStart as string),
      currentPeriodEnd: toUnixTimestamp(sub.currentPeriodEnd as string),
      cancelAtPeriodEnd: (sub.cancelAtPeriodEnd as boolean) ?? false,
    });
  }
}
