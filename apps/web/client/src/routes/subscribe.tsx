import { useAuth, SignInButton } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, BellOff, Check, LogIn } from "lucide-react";

import { useClient } from "../lib/client";

export const Route = createFileRoute("/subscribe")({
  component: SubscribePage,
});

function SubscribePage() {
  const { isSignedIn } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Bell className="h-6 w-6" />
          Notifications
        </h1>
        <p className="mt-1 text-zinc-500">
          Get notified when a stream starts or is scheduled
        </p>
      </div>

      {isSignedIn ? <NotificationToggle /> : <SignInRequired />}
    </div>
  );
}

function SignInRequired() {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
        <LogIn className="h-8 w-8 text-zinc-500" />
      </div>
      <h2 className="text-lg font-semibold">Sign in required</h2>
      <p className="mt-1 text-zinc-500">
        Create a free account to enable stream notifications.
      </p>
      <SignInButton mode="modal">
        <button className="mt-6 flex items-center gap-2 mx-auto rounded-lg border border-zinc-700 px-6 py-2 text-sm hover:bg-zinc-800">
          <LogIn className="h-4 w-4" />
          Sign In
        </button>
      </SignInButton>
    </div>
  );
}

function NotificationToggle() {
  const client = useClient();
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ["notifications", "status"],
    queryFn: async () => {
      const res = await client.subscribe.$get();
      if (!res.ok) throw new Error("Failed to fetch notification status");
      return res.json();
    },
  });

  const toggle = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable) {
        const res = await client.subscribe.$post();
        if (!res.ok) throw new Error("Failed to enable notifications");
      } else {
        const res = await client.subscribe.$delete();
        if (!res.ok) throw new Error("Failed to disable notifications");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "status"] });
    },
  });

  const isEnabled = status?.enabled ?? false;

  if (isEnabled) {
    return (
      <div className="rounded-lg border border-green-800 bg-green-950/50 p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-600">
          <Check className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">Notifications enabled</h2>
        <p className="mt-1 text-zinc-400">
          You'll be notified when a stream starts or is scheduled.
        </p>
        <button
          onClick={() => toggle.mutate(false)}
          disabled={toggle.isPending}
          className="mt-4 text-sm text-zinc-400 hover:text-zinc-300 disabled:opacity-50"
        >
          {toggle.isPending ? "..." : "Disable notifications"}
        </button>
      </div>
    );
  }

  return (
    <div className="py-20 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
        <BellOff className="h-8 w-8 text-zinc-500" />
      </div>
      <h2 className="text-lg font-semibold">Notifications disabled</h2>
      <p className="mt-1 text-zinc-500">
        Enable notifications to know when a stream starts or is scheduled.
      </p>
      <button
        onClick={() => toggle.mutate(true)}
        disabled={toggle.isPending}
        className="mt-6 rounded-lg bg-green-600 px-6 py-2 font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {toggle.isPending ? "Enabling..." : "Enable Notifications"}
      </button>
    </div>
  );
}
