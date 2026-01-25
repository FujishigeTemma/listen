import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Radio, Calendar, Archive } from "lucide-react";
import { useHealth, useSessions, useCreateSession } from "../lib/queries";
import { formatDuration, formatDate } from "../lib/utils";

export const Route = createFileRoute("/")({
	component: Dashboard,
});

function Dashboard() {
	const { data: health } = useHealth();
	const { data: sessions, isLoading } = useSessions();
	const createSession = useCreateSession();

	const handleCreateSession = () => {
		const today = new Date().toISOString().split("T")[0];
		createSession.mutate({ id: today });
	};

	return (
		<div className="space-y-8">
			{/* Status Banner */}
			{health?.recording && (
				<div className="flex items-center gap-3 rounded-lg bg-red-950 border border-red-800 px-4 py-3">
					<div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
					<span className="font-medium">Recording in progress</span>
					<span className="text-zinc-400">
						Session: {health.currentSessionId} |{" "}
						{health.recordingDuration !== null && formatDuration(health.recordingDuration)}
					</span>
					<Link
						to="/rec/$id"
						params={{ id: health.currentSessionId! }}
						className="ml-auto text-red-400 hover:text-red-300"
					>
						Go to session
					</Link>
				</div>
			)}

			{/* Quick Actions */}
			<div className="flex gap-4">
				<button
					onClick={handleCreateSession}
					disabled={createSession.isPending}
					className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 hover:bg-zinc-700 disabled:opacity-50"
				>
					<Plus className="h-4 w-4" />
					New Session
				</button>
			</div>

			{/* Sessions List */}
			<div className="space-y-4">
				<h2 className="text-lg font-semibold">Sessions</h2>
				{isLoading ? (
					<div className="text-zinc-500">Loading...</div>
				) : (sessions?.length === 0 ? (
					<div className="text-zinc-500">No sessions yet. Create one to get started.</div>
				) : (
					<div className="space-y-2">
						{sessions?.map((session) => (
							<SessionCard key={session.id} session={session} />
						))}
					</div>
				))}
			</div>
		</div>
	);
}

function SessionCard({
	session,
}: {
	session: {
		id: string;
		title: string | null;
		state: "scheduled" | "live" | "ended";
		scheduled_at: number | null;
		started_at: number | null;
		duration_seconds: number | null;
	};
}) {
	const StateIcon = {
		scheduled: Calendar,
		live: Radio,
		ended: Archive,
	}[session.state];

	const stateColors = {
		scheduled: "text-yellow-500",
		live: "text-red-500",
		ended: "text-zinc-500",
	};

	return (
		<Link
			to="/rec/$id"
			params={{ id: session.id }}
			className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-zinc-700"
		>
			<StateIcon className={`h-5 w-5 ${stateColors[session.state]}`} />
			<div className="flex-1">
				<div className="font-medium">{session.title ?? session.id}</div>
				<div className="text-sm text-zinc-500">
					{session.state === "scheduled" && session.scheduled_at
						? `Scheduled: ${formatDate(session.scheduled_at)}`
						: session.state === "live" && session.started_at
							? `Started: ${formatDate(session.started_at)}`
							: session.state === "ended" && session.duration_seconds
								? `Duration: ${formatDuration(session.duration_seconds)}`
								: session.id}
				</div>
			</div>
			<div className="text-sm capitalize text-zinc-400">{session.state}</div>
		</Link>
	);
}
