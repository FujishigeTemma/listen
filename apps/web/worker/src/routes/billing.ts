import type { Env, Variables } from "../types";
import { Hono } from "hono";

const billingRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()
  .get("/status", async (c) => {
    // TODO: Integrate with polar.sh
    const isPremium = c.get("isPremium") ?? false;

    return c.json({
      isPremium,
      plan: isPremium ? "premium" : "free",
      features: {
        archiveAccess: isPremium ? "unlimited" : "48h",
        downloadEnabled: isPremium,
        noAds: isPremium,
      },
    });
  })
  .post("/checkout", async (c) =>
    c.json({
      checkoutUrl: "https://polar.sh/checkout/placeholder",
    }),
  )
  .post("/webhook", async (c) => c.json({ received: true }));

export { billingRoutes };
