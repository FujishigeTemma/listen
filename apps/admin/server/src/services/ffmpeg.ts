import { execa } from 'execa';
import type { ResultPromise } from 'execa';
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../lib/env";

let ffmpegProcess;
let currentSessionId;
let startTime;

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
	const initSegment =
		env.HLS_FORMAT !== "mpegts" ? ["-hls_fmp4_init_filename", "init.mp4"] : [];
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

export async function startRecording(sessionId: string): Promise<void> {
	if (ffmpegProcess) {
		throw new Error("Recording already in progress");
	}

	const { liveDir, vodDir } = getOutputDirs(sessionId);

	// Create output directories
	await mkdir(liveDir, { recursive: true });
	await mkdir(vodDir, { recursive: true });

	const args = buildFfmpegArgs(sessionId);
	console.log(`[ffmpeg] starting: ffmpeg ${args.join(" ")}`);

	ffmpegProcess = execa("ffmpeg", args, {
		reject: false,
	});

	currentSessionId = sessionId;
	startTime = Date.now();

	ffmpegProcess.stdout?.on("data", (data: Buffer) => {
		console.log(`[ffmpeg stdout] ${data.toString()}`);
	});

	ffmpegProcess.stderr?.on("data", (data: Buffer) => {
		console.log(`[ffmpeg stderr] ${data.toString()}`);
	});

	ffmpegProcess.then((result) => {
		if (result.exitCode !== 0 && result.exitCode !== 255) {
			console.error(`[ffmpeg] exited with code ${result.exitCode}`);
		}
		ffmpegProcess = undefined;
		currentSessionId = undefined;
		startTime = undefined;
	});

	console.log(`[ffmpeg] started recording session ${sessionId}`);
}

export async function stopRecording(): Promise<{ durationSeconds: number } | null> {
	if (!ffmpegProcess || !startTime) {
		return ;
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
	return ffmpegProcess !== null;
}

export function getCurrentSessionId(): string | null {
	return currentSessionId;
}

export function getRecordingDuration(): number | null {
	if (!startTime) return ;
	return Math.floor((Date.now() - startTime) / 1000);
}

export async function cleanupSession(sessionId: string): Promise<void> {
	const { baseDir } = getOutputDirs(sessionId);
	await rm(baseDir, { recursive: true, force: true });
	console.log(`[ffmpeg] cleaned up session ${sessionId}`);
}
