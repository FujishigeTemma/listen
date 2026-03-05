import { tracks } from "@listen/db";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";

import type { Variables } from "../types";

import { createDB } from "../lib/db";

const tracksRoutes = new Hono<{ Bindings: Env; Variables: Variables }>().get(
  "/:sessionId",
  async (c) => {
    const isPremium = c.get("isPremium") ?? false;
    if (!isPremium) {
      return c.json({ tracks: [], requiresPremium: true });
    }

    const sessionId = c.req.param("sessionId");
    const db = createDB(c.env.DB);

    const trackList = await db.query.tracks.findMany({
      where: eq(tracks.sessionId, sessionId),
      orderBy: asc(tracks.position),
    });

    return c.json({ tracks: trackList, requiresPremium: false });
  },
);

export { tracksRoutes };
