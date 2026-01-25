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

export const subscribers = sqliteTable("subscribers", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	email: text("email").notNull().unique(),
	notifyLive: integer("notify_live", { mode: "boolean" }).notNull().default(true),
	notifyScheduled: integer("notify_scheduled", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at").notNull(),
});

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	email: text("email").notNull(),
	isPremium: integer("is_premium", { mode: "boolean" }).notNull().default(false),
	premiumExpiresAt: integer("premium_expires_at"),
	createdAt: integer("created_at").notNull(),
});
