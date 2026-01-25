import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { sessions } from "@listen/db";
import { createDb } from "../lib/db";
import type { Env, Variables } from "../types";

const sessionsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Get current live session
sessionsRoutes.get("/live", async (c) => {
	const db = createDb(c.env.DB);
	const liveSession = await db.query.sessions.findFirst({
		where: eq(sessions.state, "live"),
		with: { tracks: true },
	});

	if (!liveSession) {
		return c.json({ session: undefined });
	}

	return c.json({ session: liveSession });
});

// Get archive list (ended sessions)
sessionsRoutes.get("/archive", async (c) => {
	const db = createDb(c.env.DB);
	const now = Math.floor(Date.now() / 1000);

	// Get ended sessions that haven't expired
	const archivedSessions = await db.query.sessions.findMany({
		where: eq(sessions.state, "ended"),
		orderBy: desc(sessions.endedAt),
	});

	// Filter out expired sessions for non-premium users
	// TODO: Check premium status from context
	const isPremium = c.get("isPremium") ?? false;
	const filtered = archivedSessions.filter((s) => {
		if (isPremium) return true;
		return !s.expiresAt || s.expiresAt > now;
	});

	return c.json({ sessions: filtered });
});

// Get session by ID
sessionsRoutes.get("/:id", async (c) => {
	const id = c.req.param("id");
	const db = createDb(c.env.DB);

	const session = await db.query.sessions.findFirst({
		where: eq(sessions.id, id),
		with: { tracks: true },
	});

	if (!session) {
		return c.json({ error: "Session not found" }, 404);
	}

	// Check if expired for non-premium users
	const isPremium = c.get("isPremium") ?? false;
	const now = Math.floor(Date.now() / 1000);
	if (!isPremium && session.expiresAt && session.expiresAt < now) {
		return c.json({ error: "Session has expired" }, 403);
	}

	return c.json({ session });
});

export { sessionsRoutes };
