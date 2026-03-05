import { formatTimestamp } from "@listen/shared";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ArrowLeft, Clock, Calendar } from "lucide-react";

import type { Track } from "../queries/tracks";

import { Player } from "../components/player";
import { TrackList } from "../components/track-list";
import { TracklistLocked } from "../components/tracklist-locked";
import { sessionQueries } from "../queries/sessions";
import { trackQueries } from "../queries/tracks";

export const Route = createFileRoute("/s/$id")({
  loader: ({ context: { queryClient }, params: { id } }) => {
    void queryClient.ensureQueryData(sessionQueries.detail(id));
    void queryClient.ensureQueryData(trackQueries.bySession(id));
  },
  component: SessionPage,
});

function SessionPage() {
  const { id } = Route.useParams();
  const { data: session } = useSuspenseQuery(sessionQueries.detail(id));

  return <SessionContent session={session} />;
}

type SessionDetail = Awaited<
  ReturnType<NonNullable<ReturnType<typeof sessionQueries.detail>["queryFn"]>>
>;

function SessionContent({ session }: { session: SessionDetail }) {
  const { id } = Route.useParams();
  const { data: trackData } = useQuery(trackQueries.bySession(id));
  const isLive = session.state === "live";

  return (
    <div className="space-y-8">
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

      <Player sessionId={session.id} isLive={isLive} />

      <TrackSection trackData={trackData} />
    </div>
  );
}

function TrackSection({
  trackData,
}: {
  trackData: { tracks: Track[]; requiresPremium: boolean } | undefined;
}) {
  if (trackData?.requiresPremium) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Tracklist</h2>
        <TracklistLocked />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tracklist</h2>
      {trackData && trackData.tracks.length > 0 ? (
        <TrackList tracks={trackData.tracks} />
      ) : (
        <div className="text-zinc-500">No tracklist available</div>
      )}
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
          {dayjs.unix(startedAt).format("YYYY/MM/DD HH:mm")}
        </span>
      )}
      {durationSeconds && (
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {formatTimestamp(durationSeconds)}
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
