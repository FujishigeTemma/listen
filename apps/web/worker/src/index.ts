import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env, Variables } from "./types";
import { optionalAuthMiddleware } from "./middleware/auth";
import { sessionsRoutes } from "./routes/sessions";
import { tracksRoutes } from "./routes/tracks";
import { subscribeRoutes } from "./routes/subscribe";
import { billingRoutes } from "./routes/billing";
import { meRoutes } from "./routes/me";

const app = new Hono<{ Bindings: Env; Variables: Variables }>()
	.use("*", logger())
	.use(
		"*",
		cors({
			origin: (origin) => origin,
			credentials: true,
		})
	)
	.use("*", optionalAuthMiddleware)
	.route("/sessions", sessionsRoutes)
	.route("/tracks", tracksRoutes)
	.route("/subscribe", subscribeRoutes)
	.route("/billing", billingRoutes)
	.route("/me", meRoutes);

export type AppType = typeof app;

export default app;
