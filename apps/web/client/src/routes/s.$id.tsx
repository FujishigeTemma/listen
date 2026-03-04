import { useAuth, SignInButton } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Calendar, Crown, Lock, LogIn } from "lucide-react";

import { Player } from "../components/player";
import { TrackList } from "../components/track-list";
import { useClient } from "../lib/client";
import { formatTimestamp, formatDate } from "@listen/shared";
import { useCreateCheckout } from "../queries/billing";
import { sessionQueries } from "../queries/sessions";
import type { Track } from "../queries/tracks";
import { trackQueries } from "../queries/tracks";

export const Route = createFileRoute("/s/$id")({
  component: SessionPage,
});

function SessionPage() {
  const { id } = Route.useParams();
  const client = useClient();
  const { data: session, isPending, error } = useQuery(sessionQueries.detail(client, id));

  if (session) return <SessionContent session={session} />;

  if (error) {
    const isPremiumError = error.message === "Failed to fetch session";
    return <SessionNotFound isPremiumError={isPremiumError} />;
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  return <></>;
}

type SessionDetail = Awaited<
  ReturnType<NonNullable<ReturnType<typeof sessionQueries.detail>["queryFn"]>>
>;

function SessionContent({ session }: { session: SessionDetail }) {
  const { id } = Route.useParams();
  const client = useClient();
  const { data: trackData } = useQuery(trackQueries.bySession(client, id));
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

function TracklistLocked() {
  const { isSignedIn } = useAuth();
  const createCheckout = useCreateCheckout();

  const handleUpgrade = () => {
    createCheckout.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.checkoutUrl;
      },
    });
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
      <Lock className="mx-auto h-8 w-8 text-zinc-500" />
      <h3 className="mt-2 font-medium">Premium Feature</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Tracklist access is available for paid account holders.
      </p>
      {isSignedIn ? (
        <button
          onClick={handleUpgrade}
          disabled={createCheckout.isPending}
          className="mt-4 rounded-lg bg-yellow-600 px-6 py-2 text-sm font-medium text-black hover:bg-yellow-500 disabled:opacity-50"
        >
          {createCheckout.isPending ? "Loading..." : "Upgrade to Premium"}
        </button>
      ) : (
        <SignInButton mode="modal">
          <button className="mt-4 flex items-center gap-2 mx-auto rounded-lg border border-zinc-700 px-6 py-2 text-sm hover:bg-zinc-800">
            <LogIn className="h-4 w-4" />
            Sign in to upgrade
          </button>
        </SignInButton>
      )}
    </div>
  );
}

function SessionNotFound({ isPremiumError }: { isPremiumError: boolean }) {
  const { isSignedIn } = useAuth();
  const createCheckout = useCreateCheckout();

  const handleUpgrade = () => {
    createCheckout.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.checkoutUrl;
      },
    });
  };

  return (
    <div className="space-y-4">
      <Link to="/archive" className="flex items-center gap-1 text-zinc-400 hover:text-zinc-100">
        <ArrowLeft className="h-4 w-4" />
        Back to archive
      </Link>
      <div className="py-20 text-center">
        {isPremiumError ? (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/20">
              <Crown className="h-8 w-8 text-yellow-500" />
            </div>
            <h1 className="text-2xl font-bold">Premium Required</h1>
            <p className="mt-2 text-zinc-500">
              Archive session playback is available for paid account holders.
            </p>
            {isSignedIn ? (
              <button
                onClick={handleUpgrade}
                disabled={createCheckout.isPending}
                className="mt-6 rounded-lg bg-yellow-600 px-6 py-2 text-sm font-medium text-black hover:bg-yellow-500 disabled:opacity-50"
              >
                {createCheckout.isPending ? "Loading..." : "Upgrade to Premium"}
              </button>
            ) : (
              <SignInButton mode="modal">
                <button className="mt-6 flex items-center gap-2 mx-auto rounded-lg border border-zinc-700 px-6 py-2 text-sm hover:bg-zinc-800">
                  <LogIn className="h-4 w-4" />
                  Sign in to upgrade
                </button>
              </SignInButton>
            )}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Session Not Found</h1>
            <p className="mt-2 text-zinc-500">This session may have expired or does not exist.</p>
          </>
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
