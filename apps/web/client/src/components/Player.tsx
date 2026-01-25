import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

const HLS_BASE = import.meta.env.VITE_HLS_BASE ?? "https://hls.example.com";

interface PlayerProps {
	sessionId: string;
	isLive?: boolean;
}

export function Player({ sessionId, isLive = false }: PlayerProps) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const hlsRef = useRef<Hls | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isMuted, setIsMuted] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [error, setError] = useState<string | null>(undefined);

	const playlistUrl = `${HLS_BASE}/${sessionId}/${isLive ? "live" : "vod"}/index.m3u8`;

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		if (Hls.isSupported()) {
			const hls = new Hls({
				enableWorker: true,
				lowLatencyMode: isLive,
			});
			hlsRef.current = hls;

			hls.loadSource(playlistUrl);
			hls.attachMedia(audio);

			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				setError(undefined);
			});

			hls.on(Hls.Events.ERROR, (_, data) => {
				if (data.fatal) {
					switch (data.type) {
						case Hls.ErrorTypes.NETWORK_ERROR: {
							setError("Network error - trying to recover...");
							hls.startLoad();
							break;
						}
						case Hls.ErrorTypes.MEDIA_ERROR: {
							setError("Media error - trying to recover...");
							hls.recoverMediaError();
							break;
						}
						default: {
							setError("Playback failed");
							hls.destroy();
							break;
						}
					}
				}
			});

			return () => {
				hls.destroy();
				hlsRef.current = undefined;
			};
		} else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
			// Safari native HLS support
			audio.src = playlistUrl;
		} else {
			setError("HLS playback is not supported in this browser");
		}
	}, [playlistUrl, isLive]);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
		const handleDurationChange = () => setDuration(audio.duration);
		const handlePlay = () => setIsPlaying(true);
		const handlePause = () => setIsPlaying(false);

		audio.addEventListener("timeupdate", handleTimeUpdate);
		audio.addEventListener("durationchange", handleDurationChange);
		audio.addEventListener("play", handlePlay);
		audio.addEventListener("pause", handlePause);

		return () => {
			audio.removeEventListener("timeupdate", handleTimeUpdate);
			audio.removeEventListener("durationchange", handleDurationChange);
			audio.removeEventListener("play", handlePlay);
			audio.removeEventListener("pause", handlePause);
		};
	}, []);

	const togglePlay = () => {
		const audio = audioRef.current;
		if (!audio) return;

		if (isPlaying) {
			audio.pause();
		} else {
			audio.play();
		}
	};

	const toggleMute = () => {
		const audio = audioRef.current;
		if (!audio) return;

		audio.muted = !audio.muted;
		setIsMuted(audio.muted);
	};

	const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const audio = audioRef.current;
		if (!audio) return;

		const time = parseFloat(e.target.value);
		audio.currentTime = time;
		setCurrentTime(time);
	};

	const formatTime = (seconds: number): string => {
		if (!isFinite(seconds)) return "0:00";
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${String(secs).padStart(2, "0")}`;
	};

	return (
		<div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
			<audio ref={audioRef} />

			{error && <div className="mb-4 text-sm text-red-400">{error}</div>}

			<div className="flex items-center gap-4">
				<button
					onClick={togglePlay}
					className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700"
				>
					{isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
				</button>

				<div className="flex-1">
					{isLive ? (
						<div className="flex items-center gap-2">
							<div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
							<span className="text-sm font-medium text-red-400">LIVE</span>
						</div>
					) : (
						<div className="space-y-1">
							<input
								type="range"
								min={0}
								max={duration || 100}
								value={currentTime}
								onChange={seek}
								className="w-full cursor-pointer accent-green-500"
							/>
							<div className="flex justify-between text-xs text-zinc-500">
								<span>{formatTime(currentTime)}</span>
								<span>{formatTime(duration)}</span>
							</div>
						</div>
					)}
				</div>

				<button onClick={toggleMute} className="text-zinc-400 hover:text-zinc-100">
					{isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
				</button>
			</div>
		</div>
	);
}
