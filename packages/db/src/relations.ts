import { relations } from "drizzle-orm";

import { sessions, tracks } from "./schema";

export const sessionsRelations = relations(sessions, ({ many }) => ({
  tracks: many(tracks),
}));

export const tracksRelations = relations(tracks, ({ one }) => ({
  session: one(sessions, {
    fields: [tracks.sessionId],
    references: [sessions.id],
  }),
}));
