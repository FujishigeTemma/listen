import { relations } from "drizzle-orm";

import { sessions, tracks, users, subscriptions, notifications } from "./schema";

export const sessionsRelations = relations(sessions, ({ many }) => ({
  tracks: many(tracks),
}));

export const tracksRelations = relations(tracks, ({ one }) => ({
  session: one(sessions, {
    fields: [tracks.sessionId],
    references: [sessions.id],
  }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  subscriptions: many(subscriptions),
  notification: one(notifications),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
