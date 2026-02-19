import { vValidator } from "@hono/valibot-validator";
import { sessions, tracks } from "@listen/db";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import type { AppVariables } from "../index";

const createTrackSchema = v.object({
  position: v.number(),
  timestampSeconds: v.number(),
  artist: v.optional(v.string()),
  title: v.string(),
  label: v.optional(v.string()),
});

const updateTrackSchema = v.object({
  position: v.optional(v.number()),
  timestampSeconds: v.optional(v.number()),
  artist: v.optional(v.nullable(v.string())),
  title: v.optional(v.string()),
  label: v.optional(v.nullable(v.string())),
});

const tracksRoutes = new Hono<{ Variables: AppVariables }>()
  .get("/:sessionId", async (c) => {
    const db = c.get("db");
    const sessionId = c.req.param("sessionId");
    const trackList = await db.query.tracks.findMany({
      where: eq(tracks.sessionId, sessionId),
      orderBy: asc(tracks.position),
    });
    return c.json(trackList);
  })
  .post("/:sessionId", vValidator("json", createTrackSchema), async (c) => {
    const db = c.get("db");
    const sessionId = c.req.param("sessionId");
    const body = c.req.valid("json");

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    const [track] = await db
      .insert(tracks)
      .values({
        sessionId,
        position: body.position,
        timestampSeconds: body.timestampSeconds,
        artist: body.artist,
        title: body.title,
        label: body.label,
      })
      .returning();

    return c.json(track, 201);
  })
  .put("/:sessionId/:trackId", vValidator("json", updateTrackSchema), async (c) => {
    const db = c.get("db");
    const trackId = parseInt(c.req.param("trackId"), 10);
    const body = c.req.valid("json");

    const existing = await db.query.tracks.findFirst({
      where: eq(tracks.id, trackId),
    });
    if (!existing) {
      return c.json({ error: "Track not found" }, 404);
    }

    const [updated] = await db
      .update(tracks)
      .set({
        position: body.position,
        timestampSeconds: body.timestampSeconds,
        artist: body.artist,
        title: body.title,
        label: body.label,
      })
      .where(eq(tracks.id, trackId))
      .returning();

    return c.json(updated);
  })
  .delete("/:sessionId/:trackId", async (c) => {
    const db = c.get("db");
    const trackId = parseInt(c.req.param("trackId"), 10);

    const existing = await db.query.tracks.findFirst({
      where: eq(tracks.id, trackId),
    });
    if (!existing) {
      return c.json({ error: "Track not found" }, 404);
    }

    await db.delete(tracks).where(eq(tracks.id, trackId));
    return c.json({ success: true });
  });

export { tracksRoutes as tracks };
