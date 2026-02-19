import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Calendar } from "lucide-react";

import { Player } from "../components/player";
import { TrackList } from "../components/track-list";
import { useSession, useTracks } from "../lib/queries";
import { formatDuration, formatDate } from "../lib/utils";

export const Route = createFileRoute("/s/$id")({
  component: SessionPage,
});

function SessionPage() {
  const { id } = Route.useParams();
  const { data: session, isLoading, error } = useSession(id);
  const { data: tracks } = useTracks(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="space-y-4">
        <Link to="/archive" className="flex items-center gap-1 text-zinc-400 hover:text-zinc-100">
          <ArrowLeft className="h-4 w-4" />
          Back to archive
        </Link>
        <div className="py-20 text-center">
          <h1 className="text-2xl font-bold">Session Not Found</h1>
          <p className="mt-2 text-zinc-500">This session may have expired or does not exist.</p>
        </div>
      </div>
    );
  }

  const isLive = session.state === "live";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <Link
          to={isLive ? "/" : "/archive"}
          className="flex items-center gap-1 text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {isLive ? "Back to live" : "Back to archive"}
        </Link>

        <SessionHeader
          title={session.title ?? session.id}
          startedAt={session.startedAt}
          durationSeconds={session.durationSeconds}
          isLive={isLive}
        />
      </div>

      {/* Player */}
      <Player sessionId={session.id} isLive={isLive} />

      {/* Track List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Tracklist</h2>
        {tracks && tracks.length > 0 ? (
          <TrackList tracks={tracks} />
        ) : (
          <div className="text-zinc-500">No tracklist available</div>
        )}
      </div>
    </div>
  );
}

function SessionHeader({
  title,
  startedAt,
  durationSeconds,
  isLive,
}: {
  title: string;
  startedAt: number | null;
  durationSeconds: number | null;
  isLive: boolean;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <SessionMeta startedAt={startedAt} durationSeconds={durationSeconds} />
      </div>
      {isLive && <LiveBadge />}
    </div>
  );
}

function SessionMeta({
  startedAt,
  durationSeconds,
}: {
  startedAt: number | null;
  durationSeconds: number | null;
}) {
  return (
    <div className="mt-1 flex items-center gap-4 text-sm text-zinc-500">
      {startedAt && (
        <span className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          {formatDate(startedAt)}
        </span>
      )}
      {durationSeconds && (
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {formatDuration(durationSeconds)}
        </span>
      )}
    </div>
  );
}

function LiveBadge() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/20 px-3 py-1">
      <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
      <span className="text-sm font-medium text-red-400">LIVE</span>
    </div>
  );
}
