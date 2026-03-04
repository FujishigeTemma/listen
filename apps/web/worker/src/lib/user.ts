import type { DB } from "./db";
import { users } from "@listen/db";
import { eq } from "drizzle-orm";

/** Upsert a user from Clerk, linking clerkUserId to the local DB record. */
export async function upsertUser(db: DB, clerkUserId: string, email: string | undefined) {
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
