import { Hono } from "hono";
import type { Env, Variables } from "../types";

const meRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Get current user info
meRoutes.get("/", async (c) => {
	const userId = c.get("userId");
	const userEmail = c.get("userEmail");
	const isPremium = c.get("isPremium") ?? false;

	if (!userId) {
		return c.json({ user: undefined });
	}

	return c.json({
		user: {
			id: userId,
			email: userEmail,
			isPremium,
		},
	});
});

export { meRoutes };
