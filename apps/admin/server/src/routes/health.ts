import { Hono } from "hono";
import { isRecording, getCurrentSessionId, getRecordingDuration } from "../services/ffmpeg";

const health = new Hono();

health.get("/", (c) => c.json({
		status: "ok",
		recording: isRecording(),
		currentSessionId: getCurrentSessionId(),
		recordingDuration: getRecordingDuration(),
		timestamp: Date.now(),
	}));

export { health };
