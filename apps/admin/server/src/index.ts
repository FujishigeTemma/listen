import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./lib/env";
import { health } from "./routes/health";
import { sessions } from "./routes/sessions";
import { tracks } from "./routes/tracks";

const app = new Hono()
	.use("*", logger())
	.use("*", cors())
	.route("/health", health)
	.route("/api/sessions", sessions)
	.route("/api/tracks", tracks);

export type AppType = typeof app;

serve(
	{
		fetch: app.fetch,
		port: env.PORT,
	},
	(info) => {
		console.log(`Admin server listening on http://localhost:${info.port}`);
	}
);
