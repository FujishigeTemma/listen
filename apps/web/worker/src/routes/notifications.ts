import type { Variables } from "../types";
import { notifications } from "@listen/db";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { createDB } from "../lib/db";

const notificationRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()
  .get("/", async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ enabled: false, authenticated: false });
    }

    const db = createDB(c.env.DB);
    const notification = await db.query.notifications.findFirst({
      where: eq(notifications.userId, userId),
    });

    return c.json({ enabled: Boolean(notification), authenticated: true });
  })
  .post("/", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const db = createDB(c.env.DB);
    const now = dayjs().unix();

    const existing = await db.query.notifications.findFirst({
      where: eq(notifications.userId, userId),
    });

    if (existing) {
      return c.json({ message: "Already enabled" });
    }

    await db.insert(notifications).values({
      userId,
      createdAt: now,
      updatedAt: now,
    });

    return c.json({ message: "Notifications enabled" }, 201);
  })
  .delete("/", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const db = createDB(c.env.DB);
    await db.delete(notifications).where(eq(notifications.userId, userId));

    return c.json({ message: "Notifications disabled" });
  });

export { notificationRoutes };
