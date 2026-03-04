import { useAuth, SignInButton } from "@clerk/clerk-react";
import { Lock, LogIn } from "lucide-react";

import { useCreateCheckout } from "../queries/billing";

export function TracklistLocked() {
  const { isSignedIn } = useAuth();
  const createCheckout = useCreateCheckout();

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
      <Lock className="mx-auto h-8 w-8 text-zinc-500" />
      <h3 className="mt-2 font-medium">Premium Feature</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Tracklist access is available for paid account holders.
      </p>
      {isSignedIn ? (
        <button
          onClick={() => createCheckout.mutate()}
          disabled={createCheckout.isPending}
          className="mt-4 rounded-lg bg-yellow-600 px-6 py-2 text-sm font-medium text-black hover:bg-yellow-500 disabled:opacity-50"
        >
          {createCheckout.isPending ? "Loading..." : "Upgrade to Premium"}
        </button>
      ) : (
        <SignInButton mode="modal">
          <button className="mx-auto mt-4 flex items-center gap-2 rounded-lg border border-zinc-700 px-6 py-2 text-sm hover:bg-zinc-800">
            <LogIn className="h-4 w-4" />
            Sign in to upgrade
          </button>
        </SignInButton>
      )}
    </div>
  );
}
