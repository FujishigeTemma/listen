import { formatTimestamp } from "../lib/utils";
import type { Track } from "../lib/queries";

interface TrackListProps {
	tracks: Track[];
	currentTime?: number;
	onSeek?: (seconds: number) => void;
}

export function TrackList({ tracks, currentTime, onSeek }: TrackListProps) {
	const getCurrentTrackIndex = () => {
		if (currentTime === undefined) return -1;
		for (let i = tracks.length - 1; i >= 0; i--) {
			if (tracks[i].timestampSeconds <= currentTime) {
				return i;
			}
		}
		return -1;
	};

	const currentTrackIndex = getCurrentTrackIndex();

	if (tracks.length === 0) {
		return <div className="text-zinc-500">No tracklist available</div>;
	}

	return (
		<div className="space-y-1">
			{tracks.map((track, index) => {
				const isCurrent = index === currentTrackIndex;

				return (
					<div
						key={track.id}
						onClick={() => onSeek?.(track.timestampSeconds)}
						className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
							onSeek ? "cursor-pointer hover:bg-zinc-800" : ""
						} ${isCurrent ? "bg-zinc-800" : ""}`}
					>
						<span className="w-6 text-zinc-500">{track.position}</span>
						<span className="w-14 font-mono text-xs text-zinc-500">
							{formatTimestamp(track.timestampSeconds)}
						</span>
						<div className="flex-1 min-w-0">
							<div className={`truncate ${isCurrent ? "text-green-400" : ""}`}>
								{track.artist && (
									<span className="text-zinc-400">{track.artist} - </span>
								)}
								<span>{track.title}</span>
							</div>
							{track.label && (
								<div className="truncate text-xs text-zinc-600">[{track.label}]</div>
							)}
						</div>
						{isCurrent && (
							<div className="flex items-center gap-1">
								<div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
