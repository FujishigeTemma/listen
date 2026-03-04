import { useAuth, SignInButton } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, Calendar, Lock, LogIn } from "lucide-react";

import { Player } from "../components/player";
import { TrackList } from "../components/track-list";
import { useClient } from "../lib/client";
import { useCreateCheckout } from "../queries/billing";
import { sessionQueries } from "../queries/sessions";
import type { Track } from "../queries/tracks";
import { trackQueries } from "../queries/tracks";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const client = useClient();
  const { data: liveSession, isPending } = useQuery(sessionQueries.live(client));

  if (liveSession) {
    return <LiveView session={liveSession} />;
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  return <OfflineState />;
}

function LiveView({ session }: { session: { id: string; title: string | null } }) {
  const client = useClient();
  const { data: trackData } = useQuery({
    ...trackQueries.bySession(client, session.id),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 rounded-lg border border-red-800/50 bg-red-950/50 px-4 py-3">
        <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
        <span className="font-medium text-red-400">LIVE NOW</span>
        <span className="text-zinc-400">{session.title ?? session.id}</span>
      </div>

      <Player sessionId={session.id} isLive />

      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Radio className="h-5 w-5" />
          Now Playing
        </h2>
        <LiveTrackContent trackData={trackData} />
      </div>
    </div>
  );
}

function LiveTrackContent({
  trackData,
}: {
  trackData: { tracks: Track[]; requiresPremium: boolean } | undefined;
}) {
  if (trackData?.requiresPremium) return <TracklistLocked />;
  if (trackData && trackData.tracks.length > 0) return <TrackList tracks={trackData.tracks} />;
  return <div className="text-zinc-500">Tracklist will appear here</div>;
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
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
      <Lock className="mx-auto h-6 w-6 text-zinc-500" />
      <p className="mt-2 text-sm text-zinc-500">
        Tracklist is available for paid account holders.
      </p>
      {isSignedIn ? (
        <button
          onClick={handleUpgrade}
          disabled={createCheckout.isPending}
          className="mt-3 rounded-lg bg-yellow-600 px-4 py-1.5 text-sm font-medium text-black hover:bg-yellow-500 disabled:opacity-50"
        >
          {createCheckout.isPending ? "Loading..." : "Upgrade"}
        </button>
      ) : (
        <SignInButton mode="modal">
          <button className="mt-3 flex items-center gap-1.5 mx-auto rounded-lg border border-zinc-700 px-4 py-1.5 text-sm hover:bg-zinc-800">
            <LogIn className="h-3.5 w-3.5" />
            Sign in
          </button>
        </SignInButton>
      )}
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
        <p className="text-zinc-500">Check back later or enable notifications.</p>
        <div className="mt-6 flex justify-center gap-4">
          <Link
            to="/notifications"
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
