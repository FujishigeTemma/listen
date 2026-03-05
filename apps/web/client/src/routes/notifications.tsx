import { useAuth, SignInButton } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Bell, BellOff, Check, LogIn, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  notificationQueries,
  useSubscribeNotification,
  useUnsubscribeNotification,
} from "../queries/notifications";

interface NotificationSearch {
  verified?: "0" | "1";
  reason?: string;
  unsubscribeToken?: string;
  unsubscribed?: "0" | "1";
}

export const Route = createFileRoute("/notifications")({
  validateSearch: (search: Record<string, unknown>): NotificationSearch => {
    const parsed: NotificationSearch = {};
    if (search.verified === "1" || search.verified === "0") parsed.verified = search.verified;
    if (typeof search.reason === "string") parsed.reason = search.reason;
    if (typeof search.unsubscribeToken === "string")
      parsed.unsubscribeToken = search.unsubscribeToken;
    if (search.unsubscribed === "1" || search.unsubscribed === "0") {
      parsed.unsubscribed = search.unsubscribed;
    }
    return parsed;
  },
  component: NotificationsPage,
});

function NotificationsPage() {
  const { isSignedIn } = useAuth();
  const search = useSearch({ from: "/notifications" });
  const navigate = useNavigate({ from: "/notifications" });
  const { mutate: unsubscribeMutate } = useUnsubscribeNotification();

  const calledRef = useRef(false);
  useEffect(() => {
    if (!search.unsubscribeToken || calledRef.current) return;
    calledRef.current = true;
    unsubscribeMutate(
      { mode: "token", token: search.unsubscribeToken },
      {
        onSuccess: () => {
          void navigate({
            search: (previous) => ({
              ...previous,
              verified: undefined,
              reason: undefined,
              unsubscribeToken: undefined,
              unsubscribed: "1",
            }),
            replace: true,
          });
        },
        onError: () => {
          void navigate({
            search: (previous) => ({
              ...previous,
              verified: undefined,
              reason: undefined,
              unsubscribeToken: undefined,
              unsubscribed: "0",
            }),
            replace: true,
          });
        },
      },
    );
  }, [search.unsubscribeToken, navigate, unsubscribeMutate]);

  const infoMessage = getInfoMessage(search);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Bell className="h-6 w-6" />
          Notifications
        </h1>
        <p className="mt-1 text-zinc-500">Get notified when a stream starts or is scheduled</p>
      </div>

      {infoMessage && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
          {infoMessage}
        </div>
      )}

      {isSignedIn ? <NotificationToggle /> : <EmailSubscriptionForm />}
    </div>
  );
}

function getInfoMessage(search: NotificationSearch) {
  if (search.verified === "1") {
    return "Your email was verified and notifications were enabled.";
  }
  if (search.verified === "0") {
    return search.reason === "missing_token"
      ? "Verification failed because the token is missing."
      : "Verification link is invalid or expired.";
  }
  if (search.unsubscribed === "1") {
    return "Notifications were disabled.";
  }
  if (search.unsubscribed === "0") {
    return "Unsubscribe link is invalid or expired.";
  }
  return undefined;
}

function EmailSubscriptionForm() {
  const [email, setEmail] = useState("");
  const subscribe = useSubscribeNotification();

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold">Subscribe with email</h2>
      <p className="mt-1 text-zinc-500">
        Enter your email address and we&apos;ll send a verification link.
      </p>
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          subscribe.mutate({ mode: "email", email });
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm ring-0 outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={subscribe.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          <Mail className="h-4 w-4" />
          {subscribe.isPending ? "Sending..." : "Send verification email"}
        </button>
      </form>
      <div className="mt-3 text-xs text-zinc-500">
        Prefer account-based notifications?
        <SignInButton mode="modal">
          <button className="ml-1 inline-flex items-center gap-1 text-zinc-300 hover:text-zinc-100">
            <LogIn className="h-3 w-3" />
            Sign In
          </button>
        </SignInButton>
      </div>
      {subscribe.isSuccess && (
        <p className="mt-3 text-sm text-green-400">
          If your email is valid, a confirmation email has been sent.
        </p>
      )}
    </div>
  );
}

function NotificationToggle() {
  const { data: status } = useQuery(notificationQueries.status());
  const subscribe = useSubscribeNotification();
  const unsubscribe = useUnsubscribeNotification();
  const isEnabled = status?.enabled ?? false;
  const isPending = subscribe.isPending || unsubscribe.isPending;

  const handleClick = () => {
    if (isEnabled) {
      unsubscribe.mutate({ mode: "auth" });
    } else {
      subscribe.mutate({ mode: "auth" });
    }
  };

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
          onClick={handleClick}
          disabled={isPending}
          className="mt-4 text-sm text-zinc-400 hover:text-zinc-300 disabled:opacity-50"
        >
          {isPending ? "..." : "Disable notifications"}
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
        onClick={handleClick}
        disabled={isPending}
        className="mt-6 rounded-lg bg-green-600 px-6 py-2 font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {isPending ? "Enabling..." : "Enable Notifications"}
      </button>
    </div>
  );
}
