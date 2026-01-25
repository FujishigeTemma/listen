import { watch } from 'chokidar';
import type { FSWatcher } from 'chokidar';
import { uploadSegment, uploadPlaylist } from "./uploader";

let liveWatcher;
let vodWatcher;

export function startWatching(sessionId: string, liveDir: string, vodDir: string): void {
	stopWatching();

	// Watch live directory
	liveWatcher = watch(`${liveDir}/**/*`, {
		ignoreInitial: true,
		awaitWriteFinish: {
			stabilityThreshold: 500,
			pollInterval: 100,
		},
	});

	liveWatcher.on("add", async (path) => {
		try {
			if (path.endsWith(".m3u8")) {
				await uploadPlaylist(sessionId, "live", path);
			} else if (path.endsWith(".ts") || path.endsWith(".m4s") || path.endsWith(".mp4")) {
				await uploadSegment(sessionId, "live", path);
			}
		} catch (error) {
			console.error(`[watcher] failed to upload live ${path}:`, error);
		}
	});

	liveWatcher.on("change", async (path) => {
		try {
			if (path.endsWith(".m3u8")) {
				await uploadPlaylist(sessionId, "live", path);
			}
		} catch (error) {
			console.error(`[watcher] failed to upload live playlist ${path}:`, error);
		}
	});

	// Watch VOD directory
	vodWatcher = watch(`${vodDir}/**/*`, {
		ignoreInitial: true,
		awaitWriteFinish: {
			stabilityThreshold: 500,
			pollInterval: 100,
		},
	});

	vodWatcher.on("add", async (path) => {
		try {
			if (path.endsWith(".m3u8")) {
				await uploadPlaylist(sessionId, "vod", path);
			} else if (path.endsWith(".ts") || path.endsWith(".m4s") || path.endsWith(".mp4")) {
				await uploadSegment(sessionId, "vod", path);
			}
		} catch (error) {
			console.error(`[watcher] failed to upload vod ${path}:`, error);
		}
	});

	vodWatcher.on("change", async (path) => {
		try {
			if (path.endsWith(".m3u8")) {
				await uploadPlaylist(sessionId, "vod", path);
			}
		} catch (error) {
			console.error(`[watcher] failed to upload vod playlist ${path}:`, error);
		}
	});

	console.log(`[watcher] started watching ${liveDir} and ${vodDir}`);
}

export function stopWatching(): void {
	if (liveWatcher) {
		liveWatcher.close();
		liveWatcher = undefined;
	}
	if (vodWatcher) {
		vodWatcher.close();
		vodWatcher = undefined;
	}
	console.log("[watcher] stopped watching");
}
