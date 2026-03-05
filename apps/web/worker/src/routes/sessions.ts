import { sessions } from "@listen/db";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";

import type { Variables } from "../types";

import { createDB } from "../lib/db";

const sessionsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()
  .get("/live", async (c) => {
    const db = createDB(c.env.DB);
    const liveSession = await db.query.sessions.findFirst({
      where: eq(sessions.state, "live"),
    });

    // oxlint-disable-next-line unicorn/no-null -- null is required for JSON serialization
    return c.json({ session: liveSession ?? null });
  })
  .get("/archive", async (c) => {
    const isPremium = c.get("isPremium") ?? false;

    if (!isPremium) {
      return c.json({ sessions: [], requiresPremium: true });
    }

    const db = createDB(c.env.DB);
    const archivedSessions = await db.query.sessions.findMany({
      where: eq(sessions.state, "ended"),
      orderBy: desc(sessions.endedAt),
    });

    return c.json({ sessions: archivedSessions, requiresPremium: false });
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const db = createDB(c.env.DB);

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, id),
    });

    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    // Archive sessions require premium access
    const isPremium = c.get("isPremium") ?? false;
    if (session.state === "ended" && !isPremium) {
      return c.json({ error: "Premium required" }, 403);
    }

    return c.json({ session });
  });

export { sessionsRoutes };
