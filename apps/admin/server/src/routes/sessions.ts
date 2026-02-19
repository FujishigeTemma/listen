import { join } from "node:path";

import { vValidator } from "@hono/valibot-validator";
import { sessions } from "@listen/db";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";
import type { AppVariables } from "../index";
import type { DB } from "../services/db";

import { env } from "../lib/env";
import {
  getCurrentSessionId,
  isRecording,
  startRecording,
  stopRecording,
} from "../services/ffmpeg";
import { startWatching, stopWatching } from "../services/watcher";

const createSessionSchema = v.object({
  id: v.optional(v.string()),
  title: v.optional(v.string()),
  scheduledAt: v.optional(v.number()),
});

const scheduleSchema = v.object({
  scheduledAt: v.number(),
  title: v.optional(v.string()),
});

function findSession(db: DB, id: string) {
  return db.query.sessions.findFirst({ where: eq(sessions.id, id) });
}

async function beginLiveSession(id: string) {
  const liveDir = join(env.DATA_DIR, id, "live");
  const vodDir = join(env.DATA_DIR, id, "vod");
  await startRecording(id);
  startWatching(id, liveDir, vodDir);
}

async function endLiveSession() {
  const result = await stopRecording();
  stopWatching();
  return result;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

const sessionsRoutes = new Hono<{ Variables: AppVariables }>()
  .post("/", vValidator("json", createSessionSchema), async (c) => {
    const db = c.get("db");
    const body = c.req.valid("json");
    const id = body.id ?? new Date().toISOString().split("T")[0];

    const existing = await findSession(db, id);
    if (existing) {
      return c.json({ error: "Session already exists" }, 400);
    }

    const [session] = await db
      .insert(sessions)
      .values({
        id,
        title: body.title,
        scheduledAt: body.scheduledAt,
      })
      .returning();

    return c.json(session, 201);
  })
  .get("/", async (c) => {
    const db = c.get("db");
    const sessionsList = await db.query.sessions.findMany({
      orderBy: desc(sessions.id),
    });
    return c.json(sessionsList);
  })
  .get("/:id", async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const session = await findSession(db, id);
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.json(session);
  })
  .post("/:id/start", async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    if (isRecording()) {
      return c.json({ error: "Recording already in progress" }, 400);
    }

    const session = await findSession(db, id);
    if (!session) return c.json({ error: "Session not found" }, 404);
    if (session.state === "ended") return c.json({ error: "Session has already ended" }, 400);

    await beginLiveSession(id);

    const [updated] = await db
      .update(sessions)
      .set({ state: "live", startedAt: nowSeconds() })
      .where(eq(sessions.id, id))
      .returning();

    return c.json(updated);
  })
  .post("/:id/stop", async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    if (!isRecording() || getCurrentSessionId() !== id) {
      return c.json({ error: "Not recording this session" }, 400);
    }

    const session = await findSession(db, id);
    if (!session) return c.json({ error: "Session not found" }, 404);

    const result = await endLiveSession();
    const now = nowSeconds();

    const [updated] = await db
      .update(sessions)
      .set({
        state: "ended",
        endedAt: now,
        durationSeconds: result?.durationSeconds,
        expiresAt: now + 48 * 60 * 60,
      })
      .where(eq(sessions.id, id))
      .returning();

    return c.json(updated);
  })
  .put("/:id/schedule", vValidator("json", scheduleSchema), async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const session = await findSession(db, id);
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    if (session.state !== "scheduled") {
      return c.json({ error: "Can only update schedule for scheduled sessions" }, 400);
    }

    const [updated] = await db
      .update(sessions)
      .set({ scheduledAt: body.scheduledAt, title: body.title })
      .where(eq(sessions.id, id))
      .returning();

    return c.json(updated);
  });

export { sessionsRoutes as sessions };
