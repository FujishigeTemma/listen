import type { Variables } from "../types";
import type { InferSelectModel } from "drizzle-orm";
import { getAuth } from "@hono/clerk-auth";
import { users } from "@listen/db";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { createDB } from "../lib/db";

function checkPremium(user: InferSelectModel<typeof users>): boolean {
  if (!user.isPremium) return false;
  if (!user.premiumExpiresAt) return true;
  return user.premiumExpiresAt > Math.floor(Date.now() / 1000);
}

/** Look up authenticated user in DB and populate context variables. */
export const userMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const userId = getAuth(c)?.userId;
  if (!userId) return next();

  c.set("userId", userId);

  const user = await createDB(c.env.DB).query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (user) {
    c.set("userEmail", user.email);
    c.set("isPremium", checkPremium(user));
  }

  return next();
});
