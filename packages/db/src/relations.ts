import { relations } from "drizzle-orm";

import {
  notificationDeliveries,
  notificationEvents,
  notifications,
  sessions,
  subscriptions,
  tracks,
  users,
} from "./schema";

export const sessionsRelations = relations(sessions, ({ many }) => ({
  tracks: many(tracks),
  notificationEvents: many(notificationEvents),
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
  notificationDeliveries: many(notificationDeliveries),
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

export const notificationEventsRelations = relations(notificationEvents, ({ many, one }) => ({
  session: one(sessions, {
    fields: [notificationEvents.sessionId],
    references: [sessions.id],
  }),
  deliveries: many(notificationDeliveries),
}));

export const notificationDeliveriesRelations = relations(notificationDeliveries, ({ one }) => ({
  event: one(notificationEvents, {
    fields: [notificationDeliveries.eventId],
    references: [notificationEvents.id],
  }),
  user: one(users, {
    fields: [notificationDeliveries.userId],
    references: [users.id],
  }),
}));
