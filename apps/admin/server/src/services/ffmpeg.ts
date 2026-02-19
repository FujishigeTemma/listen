import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { execa } from "execa";
import type { ResultPromise } from "execa";

import { env } from "../lib/env";

let ffmpegProcess: ResultPromise | undefined = undefined;
let currentSessionId: string | undefined = undefined;
let startTime: number | undefined = undefined;

function getOutputDirs(sessionId: string) {
  const baseDir = join(env.DATA_DIR, sessionId);
  return {
    baseDir,
    liveDir: join(baseDir, "live"),
    vodDir: join(baseDir, "vod"),
  };
}

function buildFfmpegArgs(sessionId: string): string[] {
  const { liveDir, vodDir } = getOutputDirs(sessionId);

  const segmentExt = env.HLS_FORMAT === "mpegts" ? "ts" : "m4s";
  const initSegment = env.HLS_FORMAT !== "mpegts" ? ["-hls_fmp4_init_filename", "init.mp4"] : [];
  const hlsFlags =
    env.HLS_FORMAT === "mpegts"
      ? "delete_segments+append_list"
      : "delete_segments+append_list+independent_segments";

  return [
    // Input
    "-f",
    env.FFMPEG_INPUT_FMT,
    "-i",
    env.FFMPEG_INPUT,

    // Audio encoding
    "-c:a",
    "aac",
    "-b:a",
    env.FFMPEG_BITRATE,
    "-ac",
    "2",
    "-ar",
    "48000",

    // Live output
    "-f",
    "hls",
    "-hls_time",
    String(env.HLS_TIME),
    "-hls_list_size",
    String(env.HLS_LIST_SIZE),
    "-hls_segment_type",
    env.HLS_FORMAT === "mpegts" ? "mpegts" : "fmp4",
    ...initSegment,
    "-hls_segment_filename",
    join(liveDir, `segment_%05d.${segmentExt}`),
    "-hls_flags",
    hlsFlags,
    join(liveDir, "index.m3u8"),

    // VOD output
    "-f",
    "hls",
    "-hls_time",
    String(env.HLS_TIME),
    "-hls_list_size",
    "0",
    "-hls_segment_type",
    env.HLS_FORMAT === "mpegts" ? "mpegts" : "fmp4",
    ...initSegment,
    "-hls_segment_filename",
    join(vodDir, `segment_%05d.${segmentExt}`),
    "-hls_flags",
    "independent_segments",
    join(vodDir, "index.m3u8"),
  ];
}

function pipeProcessLogs(process: ResultPromise): void {
  process.stdout?.on("data", (data: Buffer) => {
    console.log(`[ffmpeg stdout] ${data.toString()}`);
  });
  process.stderr?.on("data", (data: Buffer) => {
    console.log(`[ffmpeg stderr] ${data.toString()}`);
  });
}

function handleProcessExit(process: ResultPromise): void {
  void (async () => {
    const result = await process;
    if (result.exitCode !== 0 && result.exitCode !== 255) {
      console.error(`[ffmpeg] exited with code ${result.exitCode}`);
    }
    ffmpegProcess = undefined;
    currentSessionId = undefined;
    startTime = undefined;
  })();
}

async function ensureOutputDirs(sessionId: string): Promise<void> {
  const { liveDir, vodDir } = getOutputDirs(sessionId);
  await mkdir(liveDir, { recursive: true });
  await mkdir(vodDir, { recursive: true });
}

function spawnFfmpeg(sessionId: string): ResultPromise {
  const args = buildFfmpegArgs(sessionId);
  console.log(`[ffmpeg] starting: ffmpeg ${args.join(" ")}`);
  return execa("ffmpeg", args, { reject: false });
}

export async function startRecording(sessionId: string): Promise<void> {
  if (ffmpegProcess) {
    throw new Error("Recording already in progress");
  }

  await ensureOutputDirs(sessionId);

  ffmpegProcess = spawnFfmpeg(sessionId);
  currentSessionId = sessionId;
  startTime = Date.now();

  pipeProcessLogs(ffmpegProcess);
  handleProcessExit(ffmpegProcess);

  console.log(`[ffmpeg] started recording session ${sessionId}`);
}

export async function stopRecording(): Promise<{ durationSeconds: number } | undefined> {
  if (!ffmpegProcess || !startTime) {
    return undefined;
  }

  const duration = Math.floor((Date.now() - startTime) / 1000);
  const sessionId = currentSessionId;

  // Send SIGINT to gracefully stop ffmpeg
  ffmpegProcess.kill("SIGINT");

  // Wait for process to exit
  await ffmpegProcess;

  console.log(`[ffmpeg] stopped recording session ${sessionId}, duration: ${duration}s`);

  return { durationSeconds: duration };
}

export function isRecording(): boolean {
  return ffmpegProcess !== undefined;
}

export function getCurrentSessionId(): string | undefined {
  return currentSessionId;
}

export function getRecordingDuration(): number | undefined {
  if (!startTime) return undefined;
  return Math.floor((Date.now() - startTime) / 1000);
}

export async function cleanupSession(sessionId: string): Promise<void> {
  const { baseDir } = getOutputDirs(sessionId);
  await rm(baseDir, { recursive: true, force: true });
  console.log(`[ffmpeg] cleaned up session ${sessionId}`);
}
