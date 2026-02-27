import type { Variables } from "../types";
import { vValidator } from "@hono/valibot-validator";
import { subscribers } from "@listen/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { createDB } from "../lib/db";

const subscribeSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  notifyLive: v.optional(v.boolean(), true),
  notifyScheduled: v.optional(v.boolean(), true),
});

const subscribeRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()
  .post("/", vValidator("json", subscribeSchema), async (c) => {
    const body = c.req.valid("json");
    const db = createDB(c.env.DB);

    // Check if already subscribed
    const existing = await db.query.subscribers.findFirst({
      where: eq(subscribers.email, body.email),
    });

    if (existing) {
      // Update preferences
      await db
        .update(subscribers)
        .set({
          notifyLive: body.notifyLive,
          notifyScheduled: body.notifyScheduled,
        })
        .where(eq(subscribers.email, body.email));

      return c.json({ message: "Preferences updated" });
    }

    // Create new subscriber
    await db.insert(subscribers).values({
      email: body.email,
      notifyLive: body.notifyLive ?? true,
      notifyScheduled: body.notifyScheduled ?? true,
      createdAt: Math.floor(Date.now() / 1000),
    });

    return c.json({ message: "Subscribed successfully" }, 201);
  })
  .delete(
    "/",
    vValidator("json", v.object({ email: v.pipe(v.string(), v.email()) })),
    async (c) => {
      const { email } = c.req.valid("json");
      const db = createDB(c.env.DB);

      await db.delete(subscribers).where(eq(subscribers.email, email));

      return c.json({ message: "Unsubscribed" });
    },
  );

export { subscribeRoutes };
