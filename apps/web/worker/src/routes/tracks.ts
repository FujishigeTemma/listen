import { Hono } from "hono";
import { eq, asc } from "drizzle-orm";
import { tracks } from "@listen/db";
import { createDb } from "../lib/db";
import type { Env, Variables } from "../types";

const tracksRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Get tracks for a session
tracksRoutes.get("/:sessionId", async (c) => {
	const sessionId = c.req.param("sessionId");
	const db = createDb(c.env.DB);

	const trackList = await db.query.tracks.findMany({
		where: eq(tracks.sessionId, sessionId),
		orderBy: asc(tracks.position),
	});

	return c.json({ tracks: trackList });
});

export { tracksRoutes };
