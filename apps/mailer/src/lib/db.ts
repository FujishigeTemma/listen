import {
  emailSuppressions,
  notificationDeliveries,
  notificationEvents,
  notificationTokens,
  notifications,
  sessions,
  users,
} from "@listen/db";
import { drizzle } from "drizzle-orm/d1";

export function createDB(d1: D1Database) {
  return drizzle(d1, {
    schema: {
      emailSuppressions,
      notificationDeliveries,
      notificationEvents,
      notificationTokens,
      notifications,
      sessions,
      users,
    },
  });
}

export type DB = ReturnType<typeof createDB>;
