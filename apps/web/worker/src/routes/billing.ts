import type { Variables } from "../types";
import { getAuth } from "@hono/clerk-auth";
import { users, subscriptions } from "@listen/db";
import { CustomerPortal, Webhooks } from "@polar-sh/hono";
import { Polar } from "@polar-sh/sdk";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { createDB } from "../lib/db";
import { handleSubscriptionEvent, type SubscriptionStatus } from "../lib/polar";
import { upsertUser } from "../lib/user";

const billingRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()
  .get("/status", async (c) => {
    const isPremium = c.get("isPremium") ?? false;
    const userId = c.get("userId");

    let subscription: { status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number | null } | undefined;
    if (userId) {
      const db = createDB(c.env.DB);
      const sub = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, "active"),
        ),
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
    // Require Clerk authentication before billing
    const auth = getAuth(c);
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

    const productId = c.env.POLAR_PRODUCT_ID;
    if (!productId) return c.json({ error: "Billing not configured" }, 500);

    const db = createDB(c.env.DB);

    // Auto-create local user from Clerk if not yet synced
    let userId = c.get("userId");
    if (!userId) {
      const clerk = c.get("clerk");
      const clerkUser = await clerk.users.getUser(auth.userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      await upsertUser(db, auth.userId, email);
      const created = await db.query.users.findFirst({
        where: eq(users.clerkUserId, auth.userId),
      });
      if (!created) return c.json({ error: "Failed to create user" }, 500);
      userId = created.id;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
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

    return Webhooks({
      webhookSecret,
      onSubscriptionCreated: async (payload) => {
        await handleSubscriptionEvent(db, payload.data, "active");
      },
      onSubscriptionActive: async (payload) => {
        await handleSubscriptionEvent(db, payload.data, "active");
      },
      onSubscriptionUpdated: async (payload) => {
        await handleSubscriptionEvent(db, payload.data, payload.data.status as SubscriptionStatus);
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
