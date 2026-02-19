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
    const [today] = new Date().toISOString().split("T");
    createSession.mutate({ id: today });
  };

  return (
    <div className="space-y-8">
      {/* Status Banner */}
      {health?.recording && (
        <div className="flex items-center gap-3 rounded-lg border border-red-800 bg-red-950 px-4 py-3">
          <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
          <span className="font-medium">Recording in progress</span>
          <span className="text-zinc-400">
            Session: {health.currentSessionId} |{" "}
            {health.recordingDuration != undefined && formatDuration(health.recordingDuration)}
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
        <SessionsList sessions={sessions} isLoading={isLoading} />
      </div>
    </div>
  );
}

interface Session {
  id: string;
  title: string | null;
  state: "scheduled" | "live" | "ended";
  scheduledAt: number | null;
  startedAt: number | null;
  durationSeconds: number | null;
}

function SessionsList({
  sessions,
  isLoading,
}: {
  sessions: Session[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <div className="text-zinc-500">Loading...</div>;
  }

  if (sessions?.length === 0) {
    return <div className="text-zinc-500">No sessions yet. Create one to get started.</div>;
  }

  return (
    <div className="space-y-2">
      {sessions?.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
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
        <div className="text-sm text-zinc-500">{formatSessionInfo(session)}</div>
      </div>
      <div className="text-sm text-zinc-400 capitalize">{session.state}</div>
    </Link>
  );
}

function formatSessionInfo(session: Session): string {
  if (session.state === "scheduled" && session.scheduledAt) {
    return `Scheduled: ${formatDate(session.scheduledAt)}`;
  }
  if (session.state === "live" && session.startedAt) {
    return `Started: ${formatDate(session.startedAt)}`;
  }
  if (session.state === "ended" && session.durationSeconds) {
    return `Duration: ${formatDuration(session.durationSeconds)}`;
  }
  return session.id;
}
