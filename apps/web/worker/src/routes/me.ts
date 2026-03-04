import type { Variables } from "../types";
import { getAuth } from "@hono/clerk-auth";
import { users } from "@listen/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { createDB } from "../lib/db";
import { upsertUser } from "../lib/user";

const meRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()
  .get("/", async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      // oxlint-disable-next-line unicorn/no-null -- null is required for JSON serialization
      return c.json({ user: null });
    }

    return c.json({
      user: {
        id: userId,
        email: c.get("userEmail") ?? "",
        isPremium: c.get("isPremium") ?? false,
      },
    });
  })
  .post("/sync", async (c) => {
    const auth = getAuth(c);
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

    const clerk = c.get("clerk");
    const clerkUser = await clerk.users.getUser(auth.userId);

    const db = createDB(c.env.DB);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    await upsertUser(db, auth.userId, email);

    const user = await db.query.users.findFirst({
      where: eq(users.clerkUserId, auth.userId),
    });

    return c.json({
      // oxlint-disable-next-line unicorn/no-null -- null is required for JSON serialization
      user: user ? { id: user.id, email: user.email, isPremium: false } : null,
    });
  });

export { meRoutes };
