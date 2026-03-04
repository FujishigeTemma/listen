import type { DB } from "../lib/db";
import type { Variables } from "../types";
import { getAuth } from "@hono/clerk-auth";
import { users } from "@listen/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { createDB } from "../lib/db";

async function upsertUser(db: DB, clerkUserId: string, email: string | undefined) {
  if (!email) return;

  const now = Math.floor(Date.now() / 1000);

  // Check by clerk_user_id first
  const byClerk = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  });

  if (byClerk) {
    if (byClerk.email !== email) {
      await db.update(users).set({ email, updatedAt: now }).where(eq(users.id, byClerk.id));
    }
    return;
  }

  // Check by email (user may have been created via webhook before signing in)
  const byEmail = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (byEmail) {
    await db
      .update(users)
      .set({ clerkUserId, updatedAt: now })
      .where(eq(users.id, byEmail.id));
    return;
  }

  await db.insert(users).values({
    email,
    clerkUserId,
    createdAt: now,
    updatedAt: now,
  });
}

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
