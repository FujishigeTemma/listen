import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";
import * as db from "../services/db";
import { startRecording, stopRecording, isRecording, getCurrentSessionId } from "../services/ffmpeg";
import { startWatching, stopWatching } from "../services/watcher";
import { env } from "../lib/env";
import { join } from "node:path";

const sessions = new Hono();

// Create a new session
const createSessionSchema = v.object({
	id: v.optional(v.string()),
	title: v.optional(v.string()),
	scheduledAt: v.optional(v.number()),
});

sessions.post("/", vValidator("json", createSessionSchema), async (c) => {
	const body = c.req.valid("json");
	const id = body.id ?? new Date().toISOString().split("T")[0];

	const existing = await db.getSession(id);
	if (existing) {
		return c.json({ error: "Session already exists" }, 400);
	}

	const session = await db.createSession(id, {
		title: body.title,
		scheduledAt: body.scheduledAt,
	});

	return c.json(session, 201);
});

// List all sessions
sessions.get("/", async (c) => {
	const sessionsList = await db.listSessions();
	return c.json(sessionsList);
});

// Get a session
sessions.get("/:id", async (c) => {
	const id = c.req.param("id");
	const session = await db.getSession(id);
	if (!session) {
		return c.json({ error: "Session not found" }, 404);
	}
	return c.json(session);
});

// Start recording
sessions.post("/:id/start", async (c) => {
	const id = c.req.param("id");

	if (isRecording()) {
		return c.json({ error: "Recording already in progress" }, 400);
	}

	const session = await db.getSession(id);
	if (!session) {
		return c.json({ error: "Session not found" }, 404);
	}

	if (session.state === "ended") {
		return c.json({ error: "Session has already ended" }, 400);
	}

	// Start ffmpeg recording
	await startRecording(id);

	// Start watching for segment uploads
	const liveDir = join(env.DATA_DIR, id, "live");
	const vodDir = join(env.DATA_DIR, id, "vod");
	startWatching(id, liveDir, vodDir);

	// Update session state
	const updated = await db.updateSession(id, {
		state: "live",
		startedAt: Math.floor(Date.now() / 1000),
	});

	return c.json(updated);
});

// Stop recording
sessions.post("/:id/stop", async (c) => {
	const id = c.req.param("id");

	if (!isRecording() || getCurrentSessionId() !== id) {
		return c.json({ error: "Not recording this session" }, 400);
	}

	const session = await db.getSession(id);
	if (!session) {
		return c.json({ error: "Session not found" }, 404);
	}

	// Stop recording and get duration
	const result = await stopRecording();
	stopWatching();

	// Calculate expiration (48 hours from now for free users)
	const expiresAt = Math.floor(Date.now() / 1000) + 48 * 60 * 60;

	// Update session state
	const updated = await db.updateSession(id, {
		state: "ended",
		endedAt: Math.floor(Date.now() / 1000),
		durationSeconds: result?.durationSeconds ?? undefined,
		expiresAt,
	});

	return c.json(updated);
});

// Update schedule
const scheduleSchema = v.object({
	scheduledAt: v.number(),
	title: v.optional(v.string()),
});

sessions.put("/:id/schedule", vValidator("json", scheduleSchema), async (c) => {
	const id = c.req.param("id");
	const body = c.req.valid("json");

	const session = await db.getSession(id);
	if (!session) {
		return c.json({ error: "Session not found" }, 404);
	}

	if (session.state !== "scheduled") {
		return c.json({ error: "Can only update schedule for scheduled sessions" }, 400);
	}

	const updated = await db.updateSession(id, {
		scheduledAt: body.scheduledAt,
		title: body.title,
	});

	return c.json(updated);
});

export { sessions };
