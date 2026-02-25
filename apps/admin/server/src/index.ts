import type { DB } from "./services/db";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { env } from "./lib/env";
import { health } from "./routes/health";
import { sessions } from "./routes/sessions";
import { tracks } from "./routes/tracks";
import { createDB } from "./services/db";

export interface AppVariables {
  db: DB;
}

const db = createDB(env.DATABASE_PATH);

const app = new Hono<{ Variables: AppVariables }>()
  .use("*", logger())
  .use("*", cors())
  .use("*", async (c, next) => {
    c.set("db", db);
    await next();
  })
  .route("/health", health)
  .route("/api/sessions", sessions)
  .route("/api/tracks", tracks);

export type AppType = typeof app;

// oxlint-disable-next-line eslint-plugin-jest/require-hook -- not test code
serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`Admin server listening on http://localhost:${info.port}`);
  },
);
