import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, Square, Clock, List } from "lucide-react";
import {
	useSession,
	useHealth,
	useStartSession,
	useStopSession,
	useTracks,
} from "../lib/queries";
import { formatDuration, formatDate, formatTimestamp } from "../lib/utils";

export const Route = createFileRoute("/rec/$id")({
	component: RecordingPage,
});

function RecordingPage() {
	const { id } = Route.useParams();
	const { data: session, isLoading } = useSession(id);
	const { data: health } = useHealth();
	const { data: tracks } = useTracks(id);
	const startSession = useStartSession();
	const stopSession = useStopSession();

	const isCurrentlyRecording = health?.recording && health.currentSessionId === id;

	if (isLoading) {
		return <div className="text-zinc-500">Loading...</div>;
	}

	if (!session) {
		return <div className="text-zinc-500">Session not found</div>;
	}

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div>
					<h1 className="text-2xl font-bold">{session.title ?? session.id}</h1>
					<div className="mt-1 text-zinc-500">
						{session.state === "scheduled" && session.scheduled_at && (
							<span>Scheduled for {formatDate(session.scheduled_at)}</span>
						)}
						{session.state === "live" && session.started_at && (
							<span>Started at {formatDate(session.started_at)}</span>
						)}
						{session.state === "ended" && session.ended_at && (
							<span>Ended at {formatDate(session.ended_at)}</span>
						)}
					</div>
				</div>
				<StatusBadge state={session.state} />
			</div>

			{/* Recording Controls */}
			{session.state !== "ended" && (
				<div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
					{isCurrentlyRecording ? (
						<>
							<div className="flex items-center gap-2">
								<div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
								<span className="font-medium text-red-400">Recording</span>
							</div>
							<div className="flex items-center gap-2 text-zinc-400">
								<Clock className="h-4 w-4" />
								{health?.recordingDuration !== null &&
									formatDuration(health.recordingDuration)}
							</div>
							<button
								onClick={() => stopSession.mutate(id)}
								disabled={stopSession.isPending}
								className="ml-auto flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 hover:bg-red-700 disabled:opacity-50"
							>
								<Square className="h-4 w-4" />
								Stop Recording
							</button>
						</>
					) : (
						<>
							<span className="text-zinc-400">Ready to record</span>
							<button
								onClick={() => startSession.mutate(id)}
								disabled={startSession.isPending || health?.recording}
								className="ml-auto flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 hover:bg-green-700 disabled:opacity-50"
							>
								<Play className="h-4 w-4" />
								Start Recording
							</button>
						</>
					)}
				</div>
			)}

			{/* Session Info */}
			{session.state === "ended" && session.duration_seconds && (
				<div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
					<div className="grid grid-cols-2 gap-4 text-sm">
						<div>
							<span className="text-zinc-500">Duration</span>
							<div className="font-medium">{formatDuration(session.duration_seconds)}</div>
						</div>
						{session.expires_at && (
							<div>
								<span className="text-zinc-500">Expires</span>
								<div className="font-medium">{formatDate(session.expires_at)}</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Track List */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="flex items-center gap-2 text-lg font-semibold">
						<List className="h-5 w-5" />
						Tracks ({tracks?.length ?? 0})
					</h2>
					<Link
						to="/tracks/$id"
						params={{ id }}
						className="text-sm text-zinc-400 hover:text-zinc-100"
					>
						Edit tracks
					</Link>
				</div>
				{tracks?.length === 0 ? (
					<div className="text-zinc-500">No tracks yet.</div>
				) : (
					<div className="space-y-1">
						{tracks?.map((track) => (
							<div
								key={track.id}
								className="flex items-center gap-4 rounded border border-zinc-800 px-3 py-2 text-sm"
							>
								<span className="w-8 text-zinc-500">{track.position}</span>
								<span className="w-16 text-zinc-500">
									{formatTimestamp(track.timestamp_seconds)}
								</span>
								<span className="flex-1">
									{track.artist && <span className="text-zinc-400">{track.artist} - </span>}
									{track.title}
								</span>
								{track.label && <span className="text-zinc-500">[{track.label}]</span>}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function StatusBadge({ state }: { state: "scheduled" | "live" | "ended" }) {
	const colors = {
		scheduled: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
		live: "bg-red-500/20 text-red-400 border-red-500/30",
		ended: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
	};

	return (
		<span className={`rounded-full border px-3 py-1 text-sm capitalize ${colors[state]}`}>
			{state}
		</span>
	);
}
