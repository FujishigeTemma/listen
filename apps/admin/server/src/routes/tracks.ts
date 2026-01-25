import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";
import * as db from "../services/db";

const tracks = new Hono();

// List tracks for a session
tracks.get("/:sessionId", async (c) => {
	const sessionId = c.req.param("sessionId");
	const trackList = await db.listTracks(sessionId);
	return c.json(trackList);
});

// Create a track
const createTrackSchema = v.object({
	position: v.number(),
	timestampSeconds: v.number(),
	artist: v.optional(v.string()),
	title: v.string(),
	label: v.optional(v.string()),
});

tracks.post("/:sessionId", vValidator("json", createTrackSchema), async (c) => {
	const sessionId = c.req.param("sessionId");
	const body = c.req.valid("json");

	const session = await db.getSession(sessionId);
	if (!session) {
		return c.json({ error: "Session not found" }, 404);
	}

	const track = await db.createTrack({
		sessionId,
		position: body.position,
		timestampSeconds: body.timestampSeconds,
		artist: body.artist,
		title: body.title,
		label: body.label,
	});

	return c.json(track, 201);
});

// Update a track
const updateTrackSchema = v.object({
	position: v.optional(v.number()),
	timestampSeconds: v.optional(v.number()),
	artist: v.optional(v.nullable(v.string())),
	title: v.optional(v.string()),
	label: v.optional(v.nullable(v.string())),
});

tracks.put("/:sessionId/:trackId", vValidator("json", updateTrackSchema), async (c) => {
	const trackId = parseInt(c.req.param("trackId"), 10);
	const body = c.req.valid("json");

	const track = await db.getTrack(trackId);
	if (!track) {
		return c.json({ error: "Track not found" }, 404);
	}

	const updated = await db.updateTrack(trackId, {
		position: body.position,
		timestampSeconds: body.timestampSeconds,
		artist: body.artist,
		title: body.title,
		label: body.label,
	});

	return c.json(updated);
});

// Delete a track
tracks.delete("/:sessionId/:trackId", async (c) => {
	const trackId = parseInt(c.req.param("trackId"), 10);

	const track = await db.getTrack(trackId);
	if (!track) {
		return c.json({ error: "Track not found" }, 404);
	}

	await db.deleteTrack(trackId);
	return c.json({ success: true });
});

export { tracks };
