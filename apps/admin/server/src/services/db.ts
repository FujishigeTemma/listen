import { env } from "../lib/env";

const D1_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.D1_DATABASE_ID}`;

interface D1QueryResult<T> {
	results: T[];
	success: boolean;
	meta: {
		changes: number;
		last_row_id: number;
		rows_read: number;
		rows_written: number;
	};
}

interface D1Response<T> {
	result: D1QueryResult<T>[];
	success: boolean;
	errors: { code: number; message: string }[];
	messages: string[];
}

async function query<T = Record<string, unknown>>(
	sql: string,
	params: unknown[] = []
): Promise<D1QueryResult<T>> {
	const response = await fetch(`${D1_API_BASE}/query`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.CF_API_TOKEN}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ sql, params }),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`D1 query failed: ${response.status} ${text}`);
	}

	const data = (await response.json()) as D1Response<T>;
	if (!data.success) {
		throw new Error(`D1 query failed: ${JSON.stringify(data.errors)}`);
	}

	return data.result[0];
}

// Session types
export interface Session {
	id: string;
	title: string | null;
	state: "scheduled" | "live" | "ended";
	scheduled_at: number | null;
	started_at: number | null;
	ended_at: number | null;
	expires_at: number | null;
	duration_seconds: number | null;
}

// Track types
export interface Track {
	id: number;
	session_id: string;
	position: number;
	timestamp_seconds: number;
	artist: string | null;
	title: string;
	label: string | null;
}

// Session operations
export async function getSession(id: string): Promise<Session | null> {
	const result = await query<Session>("SELECT * FROM sessions WHERE id = ?", [id]);
	return result.results[0] ?? undefined;
}

export async function createSession(
	id: string,
	data: { title?: string; scheduledAt?: number }
): Promise<Session> {
	await query(
		"INSERT INTO sessions (id, title, state, scheduled_at) VALUES (?, ?, 'scheduled', ?)",
		[id, data.title ?? undefined, data.scheduledAt ?? undefined]
	);
	const session = await getSession(id);
	if (!session) throw new Error("Failed to create session");
	return session;
}

export async function updateSession(
	id: string,
	data: Partial<{
		title: string | null;
		state: "scheduled" | "live" | "ended";
		scheduledAt: number | null;
		startedAt: number | null;
		endedAt: number | null;
		expiresAt: number | null;
		durationSeconds: number | null;
	}>
): Promise<Session> {
	const updates: string[] = [];
	const params: unknown[] = [];

	if (data.title !== undefined) {
		updates.push("title = ?");
		params.push(data.title);
	}
	if (data.state !== undefined) {
		updates.push("state = ?");
		params.push(data.state);
	}
	if (data.scheduledAt !== undefined) {
		updates.push("scheduled_at = ?");
		params.push(data.scheduledAt);
	}
	if (data.startedAt !== undefined) {
		updates.push("started_at = ?");
		params.push(data.startedAt);
	}
	if (data.endedAt !== undefined) {
		updates.push("ended_at = ?");
		params.push(data.endedAt);
	}
	if (data.expiresAt !== undefined) {
		updates.push("expires_at = ?");
		params.push(data.expiresAt);
	}
	if (data.durationSeconds !== undefined) {
		updates.push("duration_seconds = ?");
		params.push(data.durationSeconds);
	}

	if (updates.length === 0) {
		const session = await getSession(id);
		if (!session) throw new Error("Session not found");
		return session;
	}

	params.push(id);
	await query(`UPDATE sessions SET ${updates.join(", ")} WHERE id = ?`, params);

	const session = await getSession(id);
	if (!session) throw new Error("Session not found");
	return session;
}

export async function listSessions(): Promise<Session[]> {
	const result = await query<Session>("SELECT * FROM sessions ORDER BY id DESC");
	return result.results;
}

// Track operations
export async function getTrack(id: number): Promise<Track | null> {
	const result = await query<Track>("SELECT * FROM tracks WHERE id = ?", [id]);
	return result.results[0] ?? undefined;
}

export async function listTracks(sessionId: string): Promise<Track[]> {
	const result = await query<Track>(
		"SELECT * FROM tracks WHERE session_id = ? ORDER BY position ASC",
		[sessionId]
	);
	return result.results;
}

export async function createTrack(data: {
	sessionId: string;
	position: number;
	timestampSeconds: number;
	artist?: string;
	title: string;
	label?: string;
}): Promise<Track> {
	const result = await query(
		"INSERT INTO tracks (session_id, position, timestamp_seconds, artist, title, label) VALUES (?, ?, ?, ?, ?, ?)",
		[
			data.sessionId,
			data.position,
			data.timestampSeconds,
			data.artist ?? undefined,
			data.title,
			data.label ?? undefined,
		]
	);

	const track = await getTrack(result.meta.last_row_id);
	if (!track) throw new Error("Failed to create track");
	return track;
}

export async function updateTrack(
	id: number,
	data: Partial<{
		position: number;
		timestampSeconds: number;
		artist: string | null;
		title: string;
		label: string | null;
	}>
): Promise<Track> {
	const updates: string[] = [];
	const params: unknown[] = [];

	if (data.position !== undefined) {
		updates.push("position = ?");
		params.push(data.position);
	}
	if (data.timestampSeconds !== undefined) {
		updates.push("timestamp_seconds = ?");
		params.push(data.timestampSeconds);
	}
	if (data.artist !== undefined) {
		updates.push("artist = ?");
		params.push(data.artist);
	}
	if (data.title !== undefined) {
		updates.push("title = ?");
		params.push(data.title);
	}
	if (data.label !== undefined) {
		updates.push("label = ?");
		params.push(data.label);
	}

	if (updates.length === 0) {
		const track = await getTrack(id);
		if (!track) throw new Error("Track not found");
		return track;
	}

	params.push(id);
	await query(`UPDATE tracks SET ${updates.join(", ")} WHERE id = ?`, params);

	const track = await getTrack(id);
	if (!track) throw new Error("Track not found");
	return track;
}

export async function deleteTrack(id: number): Promise<void> {
	await query("DELETE FROM tracks WHERE id = ?", [id]);
}
