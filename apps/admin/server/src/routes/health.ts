import dayjs from "dayjs";
import { Hono } from "hono";

import { getCurrentSessionId, getRecordingDuration, isRecording } from "../services/ffmpeg";

const route = new Hono().get("/", (c) =>
  c.json({
    status: "ok",
    recording: isRecording(),
    currentSessionId: getCurrentSessionId(),
    recordingDuration: getRecordingDuration(),
    timestamp: dayjs().valueOf(),
  }),
);

export { route as health };
