import type { Variables } from "../types";
import type { DB } from "../lib/db";
import { users } from "@listen/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { createDB } from "../lib/db";

async function upsertUser(db: DB, userId: string, userEmail: string | undefined) {
  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (existing) {
    if (userEmail && existing.email !== userEmail) {
      await db.update(users).set({ email: userEmail }).where(eq(users.id, userId));
    }
  } else if (userEmail) {
    await db.insert(users).values({
      id: userId,
      email: userEmail,
      isPremium: false,
      createdAt: Math.floor(Date.now() / 1000),
    });
  }
}

function formatUser(user: { id: string; email: string; isPremium: boolean }) {
  return { id: user.id, email: user.email, isPremium: user.isPremium };
}

const meRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()
  .get("/", async (c) => {
    const userId = c.get("userId");

    if (!userId) {
      // oxlint-disable-next-line unicorn/no-null -- null is required for JSON serialization
      return c.json({ user: null });
    }

    const userEmail = c.get("userEmail");
    const isPremium = c.get("isPremium") ?? false;

    return c.json({
      user: { id: userId, email: userEmail, isPremium },
    });
  })
  .post("/sync", async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = createDB(c.env.DB);
    await upsertUser(db, userId, c.get("userEmail"));

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    // oxlint-disable-next-line unicorn/no-null -- null is required for JSON serialization
    return c.json({ user: user ? formatUser(user) : null });
  });

export { meRoutes };
