import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // YYYY-MM-DD
  title: text("title"),
  state: text("state", { enum: ["scheduled", "live", "ended"] })
    .notNull()
    .default("scheduled"),
  scheduledAt: integer("scheduled_at"),
  startedAt: integer("started_at"),
  endedAt: integer("ended_at"),
  expiresAt: integer("expires_at"),
  durationSeconds: integer("duration_seconds"),
});

export const tracks = sqliteTable("tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  timestampSeconds: integer("timestamp_seconds").notNull(),
  artist: text("artist"),
  title: text("title").notNull(),
  label: text("label"),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  clerkUserId: text("clerk_user_id").unique(),
  polarCustomerId: text("polar_customer_id").unique(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  polarSubscriptionId: text("polar_subscription_id").notNull().unique(),
  polarProductId: text("polar_product_id").notNull(),
  status: text("status", {
    enum: ["active", "canceled", "past_due", "unpaid", "incomplete", "trialing", "revoked"],
  }).notNull(),
  currentPeriodStart: integer("current_period_start"),
  currentPeriodEnd: integer("current_period_end"),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
