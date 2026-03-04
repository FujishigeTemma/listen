import type { Variables } from "../types";
import { getAuth } from "@hono/clerk-auth";
import { subscriptions, users } from "@listen/db";
import { CustomerPortal, Webhooks } from "@polar-sh/hono";
import { Polar } from "@polar-sh/sdk";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import type { DB } from "../lib/db";
import { createDB } from "../lib/db";
import { handleSubscriptionEvent, isSubscriptionStatus } from "../lib/polar";
import { upsertUser } from "../lib/user";

async function resolveUser(
  db: DB,
  opts: { userId?: number; authUserId: string; getClerkEmail: () => Promise<string | undefined> },
) {
  if (opts.userId) {
    return db.query.users.findFirst({ where: eq(users.id, opts.userId) });
  }
  const email = await opts.getClerkEmail();
  await upsertUser(db, opts.authUserId, email);
  return db.query.users.findFirst({ where: eq(users.clerkUserId, opts.authUserId) });
}

const billingRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()
  .get("/status", async (c) => {
    const isPremium = c.get("isPremium") ?? false;
    const userId = c.get("userId");

    let subscription:
      | { status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number | null }
      | undefined = undefined;
    if (userId) {
      const db = createDB(c.env.DB);
      const sub = await db.query.subscriptions.findFirst({
        where: and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")),
      });
      if (sub) {
        subscription = {
          status: sub.status,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          currentPeriodEnd: sub.currentPeriodEnd,
        };
      }
    }

    return c.json({
      isPremium,
      plan: isPremium ? "premium" : "free",
      features: {
        archiveAccess: isPremium,
        tracklistAccess: isPremium,
      },
      // oxlint-disable-next-line unicorn/no-null -- null is required for JSON serialization
      subscription: subscription ?? null,
    });
  })
  .post("/checkout", async (c) => {
    const auth = getAuth(c);
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

    const productId = c.env.POLAR_PRODUCT_ID;
    if (!productId) return c.json({ error: "Billing not configured" }, 500);

    const db = createDB(c.env.DB);
    const user = await resolveUser(db, {
      userId: c.get("userId"),
      authUserId: auth.userId,
      getClerkEmail: async () => {
        const clerkUser = await c.get("clerk").users.getUser(auth.userId);
        return clerkUser.emailAddresses[0]?.emailAddress;
      },
    });
    if (!user) return c.json({ error: "User not found" }, 404);

    const polar = new Polar({ accessToken: c.env.POLAR_ACCESS_TOKEN ?? "" });
    const checkout = await polar.checkouts.create({
      products: [productId],
      customerEmail: user.email,
      externalCustomerId: user.clerkUserId ?? undefined,
      metadata: { clerkUserId: user.clerkUserId ?? "" },
    });

    return c.json({ checkoutUrl: checkout.url });
  })
  .get("/portal", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    // oxlint-disable-next-line new-cap
    return CustomerPortal({
      accessToken: c.env.POLAR_ACCESS_TOKEN,
      getCustomerId: async () => {
        const db = createDB(c.env.DB);
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });
        return user?.polarCustomerId ?? "";
      },
    })(c);
  })
  .post("/webhook", async (c) => {
    const webhookSecret = c.env.POLAR_WEBHOOK_SECRET;
    if (!webhookSecret) return c.json({ error: "Webhook not configured" }, 500);

    const db = createDB(c.env.DB);

    // oxlint-disable-next-line new-cap
    return Webhooks({
      webhookSecret,
      onSubscriptionCreated: async (payload) => {
        await handleSubscriptionEvent(db, payload.data, "active");
      },
      onSubscriptionActive: async (payload) => {
        await handleSubscriptionEvent(db, payload.data, "active");
      },
      onSubscriptionUpdated: async (payload) => {
        const status = isSubscriptionStatus(payload.data.status) ? payload.data.status : "active";
        await handleSubscriptionEvent(db, payload.data, status);
      },
      onSubscriptionCanceled: async (payload) => {
        await handleSubscriptionEvent(db, payload.data, "canceled");
      },
      onSubscriptionRevoked: async (payload) => {
        await handleSubscriptionEvent(db, payload.data, "revoked");
      },
      onSubscriptionUncanceled: async (payload) => {
        await handleSubscriptionEvent(db, payload.data, "active");
      },
    })(c);
  });

export { billingRoutes };
