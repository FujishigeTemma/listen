import type { Variables } from "./types";
import { clerkMiddleware } from "@hono/clerk-auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { userMiddleware } from "./middleware/auth";
import { billingRoutes } from "./routes/billing";
import { clerkWebhookRoutes } from "./routes/clerk-webhook";
import { meRoutes } from "./routes/me";
import { notificationRoutes } from "./routes/notifications";
import { sessionsRoutes } from "./routes/sessions";
import { tracksRoutes } from "./routes/tracks";

const app = new Hono<{ Bindings: Env; Variables: Variables }>()
  .use("*", logger())
  .use("*", cors({ origin: (origin) => origin, credentials: true }))
  // Webhook: before clerkMiddleware so raw body is intact for signature verification
  .route("/clerk/webhook", clerkWebhookRoutes)
  .use("*", clerkMiddleware())
  .use("*", userMiddleware)
  .route("/sessions", sessionsRoutes)
  .route("/tracks", tracksRoutes)
  .route("/notifications", notificationRoutes)
  .route("/billing", billingRoutes)
  .route("/me", meRoutes)
  .get("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

export type AppType = typeof app;

export default app;
