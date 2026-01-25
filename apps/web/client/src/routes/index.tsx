import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, Calendar } from "lucide-react";
import { useLiveSession } from "../lib/queries";
import { Player } from "../components/Player";
import { TrackList } from "../components/TrackList";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	const { data: liveSession, isLoading } = useLiveSession();

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<div className="text-zinc-500">Loading...</div>
			</div>
		);
	}

	if (!liveSession) {
		return <OfflineState />;
	}

	return (
		<div className="space-y-8">
			{/* Live Banner */}
			<div className="flex items-center gap-3 rounded-lg bg-red-950/50 border border-red-800/50 px-4 py-3">
				<div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
				<span className="font-medium text-red-400">LIVE NOW</span>
				<span className="text-zinc-400">{liveSession.title ?? liveSession.id}</span>
			</div>

			{/* Player */}
			<Player sessionId={liveSession.id} isLive />

			{/* Track List */}
			<div className="space-y-4">
				<h2 className="flex items-center gap-2 text-lg font-semibold">
					<Radio className="h-5 w-5" />
					Now Playing
				</h2>
				{liveSession.tracks && liveSession.tracks.length > 0 ? (
					<TrackList tracks={liveSession.tracks} />
				) : (
					<div className="text-zinc-500">Tracklist will appear here</div>
				)}
			</div>
		</div>
	);
}

function OfflineState() {
	return (
		<div className="space-y-8">
			<div className="py-20 text-center">
				<div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800">
					<Radio className="h-10 w-10 text-zinc-500" />
				</div>
				<h1 className="text-2xl font-bold">Currently Offline</h1>
				<p className="mt-2 text-zinc-500">No live stream at the moment.</p>
				<p className="text-zinc-500">Check back later or subscribe to get notified.</p>
				<div className="mt-6 flex justify-center gap-4">
					<Link
						to="/subscribe"
						className="rounded-lg bg-green-600 px-6 py-2 font-medium hover:bg-green-700"
					>
						Get Notified
					</Link>
					<Link
						to="/archive"
						className="rounded-lg border border-zinc-700 px-6 py-2 hover:bg-zinc-800"
					>
						Browse Archive
					</Link>
				</div>
			</div>

			{/* Upcoming section (placeholder) */}
			<div className="space-y-4">
				<h2 className="flex items-center gap-2 text-lg font-semibold">
					<Calendar className="h-5 w-5" />
					Upcoming
				</h2>
				<div className="text-zinc-500">No scheduled sessions at the moment.</div>
			</div>
		</div>
	);
}
