import type { Variables } from "../types";
import { notifications } from "@listen/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { createDB } from "../lib/db";

const subscribeRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()
  .get("/", async (c) => {
    const dbUserId = c.get("dbUserId");
    if (!dbUserId) {
      return c.json({ enabled: false, authenticated: false });
    }

    const db = createDB(c.env.DB);
    const notification = await db.query.notifications.findFirst({
      where: eq(notifications.userId, dbUserId),
    });

    return c.json({ enabled: Boolean(notification), authenticated: true });
  })
  .post("/", async (c) => {
    const dbUserId = c.get("dbUserId");
    if (!dbUserId) return c.json({ error: "Unauthorized" }, 401);

    const db = createDB(c.env.DB);
    const now = Math.floor(Date.now() / 1000);

    const existing = await db.query.notifications.findFirst({
      where: eq(notifications.userId, dbUserId),
    });

    if (existing) {
      return c.json({ message: "Already enabled" });
    }

    await db.insert(notifications).values({
      userId: dbUserId,
      createdAt: now,
      updatedAt: now,
    });

    return c.json({ message: "Notifications enabled" }, 201);
  })
  .delete("/", async (c) => {
    const dbUserId = c.get("dbUserId");
    if (!dbUserId) return c.json({ error: "Unauthorized" }, 401);

    const db = createDB(c.env.DB);
    await db.delete(notifications).where(eq(notifications.userId, dbUserId));

    return c.json({ message: "Notifications disabled" });
  });

export { subscribeRoutes };
