import type { Variables } from "../types";
import { users, subscriptions } from "@listen/db";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { createDB } from "../lib/db";
import { createPolar, handleWebhookEvent } from "../lib/polar";

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
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const productId = c.env.POLAR_PRODUCT_ID;
    if (!productId) return c.json({ error: "Billing not configured" }, 500);

    const db = createDB(c.env.DB);
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) return c.json({ error: "User not found" }, 404);

    const polar = createPolar(c.env);
    const checkout = await polar.checkouts.create({
      products: [productId],
      customerEmail: user.email,
      metadata: { userId: String(user.id) },
    });

    return c.json({ checkoutUrl: checkout.url });
  })
  .post("/webhook", async (c) => {
    const webhookSecret = c.env.POLAR_WEBHOOK_SECRET;
    if (!webhookSecret) return c.json({ error: "Webhook not configured" }, 500);

    const body = await c.req.text();
    const headers = Object.fromEntries(c.req.raw.headers.entries());
    const db = createDB(c.env.DB);

    try {
      await handleWebhookEvent(body, headers, webhookSecret, db);
    } catch (error) {
      if (error instanceof Error && error.name === "WebhookVerificationError") {
        return c.json({ error: "Invalid signature" }, 403);
      }
      throw error;
    }

    return c.json({ received: true });
  })
  .post("/portal", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const db = createDB(c.env.DB);
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user?.polarCustomerId) return c.json({ error: "No subscription found" }, 404);

    const polar = createPolar(c.env);
    const session = await polar.customerSessions.create({
      customerId: user.polarCustomerId,
    });

    return c.json({ portalUrl: session.customerPortalUrl });
  });

export { billingRoutes };
