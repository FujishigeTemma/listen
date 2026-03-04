import { useAuth, SignInButton } from "@clerk/clerk-react";
import { Crown, LogIn } from "lucide-react";

import { useCreateCheckout } from "../queries/billing";

export function PremiumRequired() {
  const { isSignedIn } = useAuth();
  const createCheckout = useCreateCheckout();

  return (
    <div className="py-20 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/20">
        <Crown className="h-8 w-8 text-yellow-500" />
      </div>
      <h2 className="text-lg font-semibold">Premium Feature</h2>
      <p className="mt-1 text-zinc-500">This content is available for paid account holders.</p>
      {isSignedIn ? (
        <button
          onClick={() => createCheckout.mutate()}
          disabled={createCheckout.isPending}
          className="mt-6 rounded-lg bg-yellow-600 px-6 py-2 text-sm font-medium text-black hover:bg-yellow-500 disabled:opacity-50"
        >
          {createCheckout.isPending ? "Loading..." : "Upgrade to Premium"}
        </button>
      ) : (
        <SignInButton mode="modal">
          <button className="mx-auto mt-6 flex items-center gap-2 rounded-lg border border-zinc-700 px-6 py-2 text-sm hover:bg-zinc-800">
            <LogIn className="h-4 w-4" />
            Sign in to upgrade
          </button>
        </SignInButton>
      )}
    </div>
  );
}
