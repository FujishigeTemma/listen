import type { DB } from "./db";
import { users } from "@listen/db";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";

async function findExistingUser(db: DB, clerkUserId: string, email: string) {
  const byClerk = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  });
  if (byClerk) return byClerk;

  return db.query.users.findFirst({
    where: eq(users.email, email),
  });
}

/** Upsert a user from Clerk, linking clerkUserId to the local DB record. */
export async function upsertUser(db: DB, clerkUserId: string, email: string | undefined) {
  if (!email) return;

  const now = dayjs().unix();
  const existing = await findExistingUser(db, clerkUserId, email);

  if (!existing) {
    await db.insert(users).values({ email, clerkUserId, createdAt: now, updatedAt: now });
    return;
  }

  if (existing.clerkUserId === clerkUserId) {
    if (existing.email !== email) {
      await db.update(users).set({ email, updatedAt: now }).where(eq(users.id, existing.id));
    }
  } else {
    await db.update(users).set({ clerkUserId, updatedAt: now }).where(eq(users.id, existing.id));
  }
}
