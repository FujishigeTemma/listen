import { Hono } from "hono";
import type { Env, Variables } from "../types";

const billingRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Get billing status (stub)
billingRoutes.get("/status", async (c) => {
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
});

// Create checkout session (stub)
billingRoutes.post("/checkout", async (c) => c.json({
		checkoutUrl: "https://polar.sh/checkout/placeholder",
	}));

// Handle webhook (stub)
billingRoutes.post("/webhook", async (c) => c.json({ received: true }));

export { billingRoutes };
