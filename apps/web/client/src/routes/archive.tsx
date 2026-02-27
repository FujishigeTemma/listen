import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, Clock, Calendar } from "lucide-react";

import { useClient } from "../lib/client";
import { formatDuration, formatDate } from "../lib/utils";
import { sessionQueries } from "../queries/sessions";

export const Route = createFileRoute("/archive")({
  component: ArchivePage,
});

function ArchivePage() {
  const client = useClient();
  const { data: sessions, isPending } = useQuery(sessionQueries.archive(client));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Archive className="h-6 w-6" />
          Archive
        </h1>
        <p className="mt-1 text-zinc-500">Past sessions available for replay</p>
      </div>

      <SessionList sessions={sessions} isPending={isPending} />
    </div>
  );
}

interface Session {
  id: string;
  title: string | null;
  startedAt: number | null;
  endedAt: number | null;
  durationSeconds: number | null;
  expiresAt: number | null;
}

function SessionList({
  sessions,
  isPending,
}: {
  sessions: Session[] | undefined;
  isPending: boolean;
}) {
  if (sessions && sessions.length > 0) {
    return (
      <div className="space-y-2">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    );
  }

  if (isPending) {
    return <div className="text-zinc-500">Loading...</div>;
  }

  return <EmptyState />;
}

function EmptyState() {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
        <Archive className="h-8 w-8 text-zinc-500" />
      </div>
      <h2 className="text-lg font-semibold">No archived sessions</h2>
      <p className="mt-1 text-zinc-500">Check back after a live session ends.</p>
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  const isExpiring = session.expiresAt
    ? session.expiresAt - Date.now() / 1000 < 24 * 60 * 60
    : false;

  return (
    <Link
      to="/s/$id"
      params={{ id: session.id }}
      className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-zinc-700"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
        <Archive className="h-5 w-5 text-zinc-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{session.title ?? session.id}</div>
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          {session.startedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(session.startedAt)}
            </span>
          )}
          {session.durationSeconds && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(session.durationSeconds)}
            </span>
          )}
        </div>
      </div>
      {isExpiring && <span className="text-xs text-yellow-500">Expiring soon</span>}
    </Link>
  );
}
