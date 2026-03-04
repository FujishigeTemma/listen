import { useAuth, SignInButton } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Settings, Crown, LogIn, Bell, BellOff } from "lucide-react";

import { useClient } from "../lib/client";
import { billingQueries, useCreateCheckout } from "../queries/billing";
import { meQueries } from "../queries/me";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const client = useClient();
  const { isSignedIn } = useAuth();
  const { data: user } = useQuery({
    ...meQueries.current(client),
    enabled: Boolean(isSignedIn),
  });
  const { data: billing } = useQuery({
    ...billingQueries.status(client),
    enabled: Boolean(isSignedIn),
  });
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Account</h2>
        {user ? <AccountCard email={user.email} isPremium={billing?.isPremium ?? false} /> : <SignInPrompt />}
      </section>

      {isSignedIn && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <NotificationCard />
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Premium</h2>
        <PremiumCard
          isPremium={billing?.isPremium ?? false}
          subscription={billing?.subscription}
          onUpgrade={handleUpgrade}
          isLoading={createCheckout.isPending}
        />
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
        <div>
          <div className="font-medium">{email ?? "Unknown"}</div>
          <div className="text-sm text-zinc-500">
            {isPremium ? "Premium Member" : "Free Account"}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
      <LogIn className="mx-auto h-8 w-8 text-zinc-500" />
      <h3 className="mt-2 font-medium">Sign in to access more features</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Create an account to enable notifications and upgrade to premium
      </p>
      <SignInButton mode="modal">
        <button className="mt-4 rounded-lg border border-zinc-700 px-6 py-2 text-sm hover:bg-zinc-800">
          Sign In
        </button>
      </SignInButton>
    </div>
  );
}

function NotificationCard() {
  const client = useClient();
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ["notifications", "status"],
    queryFn: async () => {
      const res = await client.notifications.$get();
      if (!res.ok) throw new Error("Failed to fetch notification status");
      return res.json();
    },
  });

  const toggle = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable) {
        const res = await client.notifications.$post();
        if (!res.ok) throw new Error("Failed to enable notifications");
      } else {
        const res = await client.notifications.$delete();
        if (!res.ok) throw new Error("Failed to disable notifications");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "status"] });
    },
  });

  const isEnabled = status?.enabled ?? false;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isEnabled ? (
            <Bell className="h-5 w-5 text-green-500" />
          ) : (
            <BellOff className="h-5 w-5 text-zinc-500" />
          )}
          <div>
            <div className="font-medium">Stream Notifications</div>
            <div className="text-sm text-zinc-500">
              Get notified when a stream starts or is scheduled
            </div>
          </div>
        </div>
        <button
          onClick={() => toggle.mutate(!isEnabled)}
          disabled={toggle.isPending}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            isEnabled
              ? "border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {toggle.isPending ? "..." : isEnabled ? "Disable" : "Enable"}
        </button>
      </div>
    </div>
  );
}

function PremiumCard({
  isPremium,
  subscription,
  onUpgrade,
  isLoading,
}: {
  isPremium: boolean;
  subscription?: { status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number | null } | null;
  onUpgrade: () => void;
  isLoading: boolean;
}) {
  const handleManage = () => {
    window.location.href = "/billing/portal";
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/20">
          <Crown className="h-6 w-6 text-yellow-500" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{isPremium ? "Premium Active" : "Upgrade to Premium"}</h3>
          <ul className="mt-2 space-y-1 text-sm text-zinc-400">
            <li>Archive access for past sessions</li>
            <li>Full tracklist access</li>
            <li>Support the stream</li>
          </ul>
          {isPremium ? (
            <div className="mt-4 space-y-2">
              {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
                <div className="text-sm text-yellow-500">
                  Cancels at end of period ({new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()})
                </div>
              )}
              <button
                onClick={handleManage}
                className="rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
              >
                Manage Subscription
              </button>
            </div>
          ) : (
            <button
              onClick={onUpgrade}
              disabled={isLoading}
              className="mt-4 rounded-lg bg-yellow-600 px-6 py-2 text-sm font-medium text-black hover:bg-yellow-500 disabled:opacity-50"
            >
              {isLoading ? "Loading..." : "Upgrade Now"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
