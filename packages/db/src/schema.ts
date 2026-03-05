import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const notificationTokens = sqliteTable(
  "notification_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    purpose: text("purpose", { enum: ["subscribe_verify", "unsubscribe"] }).notNull(),
    requestIp: text("request_ip").notNull(),
    expiresAt: integer("expires_at").notNull(),
    consumedAt: integer("consumed_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({
    emailCreatedAtIdx: index("notification_tokens_email_created_at_idx").on(
      table.email,
      table.createdAt,
    ),
    requestIpCreatedAtIdx: index("notification_tokens_request_ip_created_at_idx").on(
      table.requestIp,
      table.createdAt,
    ),
  }),
);

export const notificationEvents = sqliteTable(
  "notification_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventKey: text("event_key").notNull().unique(),
    eventType: text("event_type", {
      enum: ["live_started", "scheduled_created"],
    }).notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    sessionState: text("session_state", { enum: ["scheduled", "live", "ended"] }).notNull(),
    occurredAt: integer("occurred_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({
    eventTypeOccurredAtIdx: index("notification_events_event_type_occurred_at_idx").on(
      table.eventType,
      table.occurredAt,
    ),
  }),
);

export const notificationDeliveries = sqliteTable(
  "notification_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: integer("event_id")
      .notNull()
      .references(() => notificationEvents.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    status: text("status", { enum: ["queued", "processing", "sent", "failed"] })
      .notNull()
      .default("queued"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextRetryAt: integer("next_retry_at"),
    lastError: text("last_error"),
    queuedAt: integer("queued_at").notNull(),
    sentAt: integer("sent_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    eventUserUnique: uniqueIndex("notification_deliveries_event_user_unique").on(
      table.eventId,
      table.userId,
    ),
    statusRetryIdx: index("notification_deliveries_status_next_retry_at_idx").on(
      table.status,
      table.nextRetryAt,
    ),
    eventStatusIdx: index("notification_deliveries_event_id_status_idx").on(
      table.eventId,
      table.status,
    ),
  }),
);

export const emailSuppressions = sqliteTable("email_suppressions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  reason: text("reason", { enum: ["hard_bounce", "complaint", "manual"] }).notNull(),
  sourceEmailId: text("source_email_id"),
  createdAt: integer("created_at").notNull(),
});
