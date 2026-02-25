import type { InferOutput } from "valibot";
import * as v from "valibot";

const EnvSchema = v.object({
  PORT: v.pipe(
    v.optional(v.string(), "8080"),
    v.transform((val) => parseInt(val, 10)),
  ),
  DATA_DIR: v.optional(v.string(), "./data"),

  // Ffmpeg
  FFMPEG_INPUT_FMT: v.optional(v.string(), "avfoundation"),
  FFMPEG_INPUT: v.optional(v.string(), ":0"),
  FFMPEG_BITRATE: v.optional(v.string(), "192k"),
  HLS_TIME: v.pipe(
    v.optional(v.string(), "4"),
    v.transform((val) => parseInt(val, 10)),
  ),
  HLS_LIST_SIZE: v.pipe(
    v.optional(v.string(), "15"),
    v.transform((val) => parseInt(val, 10)),
  ),
  HLS_FORMAT: v.optional(v.picklist(["mpegts", "fmp4", "cmaf"]), "cmaf"),

  // Database
  DATABASE_PATH: v.optional(v.string(), "./data/admin.db"),

  // R2 (optional)
  R2_ENDPOINT: v.optional(v.string()),
  R2_ACCESS_KEY_ID: v.optional(v.string()),
  R2_SECRET_ACCESS_KEY: v.optional(v.string()),
  R2_BUCKET: v.optional(v.string(), "dj-hls"),
});

export type Env = InferOutput<typeof EnvSchema>;

export function parseEnv(): Env {
  const result = v.safeParse(EnvSchema, process.env);
  if (!result.success) {
    const issues = v.flatten(result.issues);
    console.error("Invalid environment variables:", issues);
    throw new Error("Invalid environment variables");
  }
  return result.output;
}

export const env = parseEnv();
