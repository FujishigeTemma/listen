import type { Variables } from "../types";
import { getAuth } from "@hono/clerk-auth";
import { users, subscriptions } from "@listen/db";
import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { createDB } from "../lib/db";

/** Look up authenticated user in DB and populate context variables. */
export const userMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const clerkUserId = getAuth(c)?.userId;
  if (!clerkUserId) return next();

  c.set("userId", clerkUserId);

  const db = createDB(c.env.DB);
  const user = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  });

  if (user) {
    c.set("userEmail", user.email);
    c.set("dbUserId", user.id);

    const activeSubscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.userId, user.id),
        eq(subscriptions.status, "active"),
      ),
    });

    c.set("isPremium", Boolean(activeSubscription));
  }

  return next();
});
