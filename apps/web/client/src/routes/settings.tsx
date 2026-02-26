import { SignInButton } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { Settings, Crown, LogIn } from "lucide-react";

import { isAuthEnabled } from "../lib/clerk";
import { useCurrentUser, useBillingStatus, useCreateCheckout } from "../lib/queries";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: user } = useCurrentUser();
  const { data: billing } = useBillingStatus();
  const createCheckout = useCreateCheckout();

  const handleUpgrade = () => {
    createCheckout.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.checkoutUrl;
      },
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="mt-1 text-zinc-500">Manage your account and preferences</p>
      </div>

      {/* Account Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Account</h2>
        {user ? <AccountCard email={user.email} isPremium={user.isPremium} /> : <SignInPrompt />}
      </section>

      {/* Premium Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Premium</h2>
        <PremiumCard
          isPremium={billing?.isPremium ?? false}
          onUpgrade={handleUpgrade}
          isLoading={createCheckout.isPending}
        />
      </section>

      {/* Playback Settings */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Playback</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="text-zinc-500">
            Playback settings will be available in a future update.
          </div>
        </div>
      </section>
    </div>
  );
}

function AccountCard({ email, isPremium }: { email: string | undefined; isPremium: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-lg font-bold">
          {email?.[0]?.toUpperCase() ?? "?"}
        </div>
        <AccountInfo email={email} isPremium={isPremium} />
      </div>
    </div>
  );
}

function AccountInfo({ email, isPremium }: { email: string | undefined; isPremium: boolean }) {
  return (
    <div>
      <div className="font-medium">{email ?? "Unknown"}</div>
      <div className="text-sm text-zinc-500">{isPremium ? "Premium Member" : "Free Account"}</div>
    </div>
  );
}

function SignInPrompt() {
  const authEnabled = isAuthEnabled();

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
      <LogIn className="mx-auto h-8 w-8 text-zinc-500" />
      <h3 className="mt-2 font-medium">Sign in to access more features</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Create an account to sync your preferences and upgrade to premium
      </p>
      {authEnabled ? (
        <SignInButton mode="modal">
          <button className="mt-4 rounded-lg border border-zinc-700 px-6 py-2 text-sm hover:bg-zinc-800">
            Sign In
          </button>
        </SignInButton>
      ) : (
        <button
          disabled
          className="mt-4 rounded-lg border border-zinc-700 px-6 py-2 text-sm opacity-50"
        >
          Sign In (Not Configured)
        </button>
      )}
    </div>
  );
}

function PremiumCard({
  isPremium,
  onUpgrade,
  isLoading,
}: {
  isPremium: boolean;
  onUpgrade: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-start gap-4">
        <PremiumIcon />
        <PremiumContent isPremium={isPremium} onUpgrade={onUpgrade} isLoading={isLoading} />
      </div>
    </div>
  );
}

function PremiumIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/20">
      <Crown className="h-6 w-6 text-yellow-500" />
    </div>
  );
}

function PremiumContent({
  isPremium,
  onUpgrade,
  isLoading,
}: {
  isPremium: boolean;
  onUpgrade: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex-1">
      <h3 className="font-semibold">{isPremium ? "Premium Active" : "Upgrade to Premium"}</h3>
      <ul className="mt-2 space-y-1 text-sm text-zinc-400">
        <li>Unlimited archive access (no 48h expiration)</li>
        <li>Download recordings for offline listening</li>
        <li>No advertisements</li>
        <li>Support the stream</li>
      </ul>
      {!isPremium && (
        <button
          onClick={onUpgrade}
          disabled={isLoading}
          className="mt-4 rounded-lg bg-yellow-600 px-6 py-2 text-sm font-medium text-black hover:bg-yellow-500 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Upgrade Now"}
        </button>
      )}
    </div>
  );
}
