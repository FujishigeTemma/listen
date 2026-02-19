import { Hono } from "hono";

import { getCurrentSessionId, getRecordingDuration, isRecording } from "../services/ffmpeg";

const health = new Hono().get("/", (c) =>
  c.json({
    status: "ok",
    recording: isRecording(),
    currentSessionId: getCurrentSessionId(),
    recordingDuration: getRecordingDuration(),
    timestamp: Date.now(),
  }),
);

export { health };
