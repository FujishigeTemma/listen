import type { Env, Variables } from "../types";
import { tracks } from "@listen/db";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";

import { createDB } from "../lib/db";

const tracksRoutes = new Hono<{ Bindings: Env; Variables: Variables }>().get(
  "/:sessionId",
  async (c) => {
    const sessionId = c.req.param("sessionId");
    const db = createDB(c.env.DB);

    const trackList = await db.query.tracks.findMany({
      where: eq(tracks.sessionId, sessionId),
      orderBy: asc(tracks.position),
    });

    return c.json({ tracks: trackList });
  },
);

export { tracksRoutes };
