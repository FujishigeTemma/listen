import type { Env, Variables } from "./types";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { billingRoutes } from "./routes/billing";
import { meRoutes } from "./routes/me";
import { sessionsRoutes } from "./routes/sessions";
import { subscribeRoutes } from "./routes/subscribe";
import { tracksRoutes } from "./routes/tracks";

const app = new Hono<{ Bindings: Env; Variables: Variables }>()
  .use("*", logger())
  .use(
    "*",
    cors({
      origin: (origin) => origin,
      credentials: true,
    }),
  )
  // .use("*", optionalAuthMiddleware)
  .route("/sessions", sessionsRoutes)
  .route("/tracks", tracksRoutes)
  .route("/subscribe", subscribeRoutes)
  .route("/billing", billingRoutes)
  .route("/me", meRoutes)
  .get("*", async (c) => {
    return c.env.ASSETS.fetch(c.req.raw);
  });

export type AppType = typeof app;

export default app;
