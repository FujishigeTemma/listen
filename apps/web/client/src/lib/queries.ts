import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { useAuthToken } from "./clerk";
import { client, createClient } from "./client";

type TracksResponse = InferResponseType<(typeof client.tracks)[":sessionId"]["$get"]>;
export type Track = TracksResponse extends { tracks: (infer T)[] } ? T : never;

/** Returns an authenticated Hono client when signed in, public client otherwise. */
function useClient() {
  const getToken = useAuthToken();
  if (!getToken) return client;
  return createClient(getToken);
}

export function useLiveSession() {
  return useQuery({
    queryKey: ["sessions", "live"],
    queryFn: async () => {
      const res = await client.sessions.live.$get();
      if (!res.ok) throw new Error("Failed to fetch live session");
      const data = await res.json();
      return data.session;
    },
    refetchInterval: 10_000, // Poll every 10 seconds
  });
}

export function useArchiveSessions() {
  const authedClient = useClient();
  return useQuery({
    queryKey: ["sessions", "archive"],
    queryFn: async () => {
      const res = await authedClient.sessions.archive.$get();
      if (!res.ok) throw new Error("Failed to fetch archive");
      const data = await res.json();
      return data.sessions;
    },
  });
}

export function useSession(id: string) {
  const authedClient = useClient();
  return useQuery({
    queryKey: ["sessions", id],
    queryFn: async () => {
      const res = await authedClient.sessions[":id"].$get({ param: { id } });
      if (!res.ok) throw new Error("Failed to fetch session");
      const data = await res.json();
      return data.session;
    },
  });
}

export function useTracks(sessionId: string) {
  return useQuery({
    queryKey: ["tracks", sessionId],
    queryFn: async () => {
      const res = await client.tracks[":sessionId"].$get({ param: { sessionId } });
      if (!res.ok) throw new Error("Failed to fetch tracks");
      const data = await res.json();
      return data.tracks;
    },
  });
}

export function useSubscribe() {
  return useMutation({
    mutationFn: async (data: {
      email: string;
      notifyLive?: boolean;
      notifyScheduled?: boolean;
    }) => {
      const res = await client.subscribe.$post({ json: data });
      if (!res.ok) throw new Error("Failed to subscribe");
      return res.json();
    },
  });
}

export function useCurrentUser() {
  const authedClient = useClient();
  const hasAuth = useAuthToken() !== undefined;
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await authedClient.me.$get();
      if (!res.ok) throw new Error("Failed to fetch user");
      const data = await res.json();
      return data.user;
    },
    enabled: hasAuth,
  });
}

/** Sync user data to the database after sign-in. */
export function useSyncUser() {
  const authedClient = useClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await authedClient.me.sync.$post();
      if (!res.ok) throw new Error("Failed to sync user");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useBillingStatus() {
  const authedClient = useClient();
  const hasAuth = useAuthToken() !== undefined;
  return useQuery({
    queryKey: ["billing", "status"],
    queryFn: async () => {
      const res = await authedClient.billing.status.$get();
      if (!res.ok) throw new Error("Failed to fetch billing status");
      return res.json();
    },
    enabled: hasAuth,
  });
}

export function useCreateCheckout() {
  const authedClient = useClient();
  return useMutation({
    mutationFn: async () => {
      const res = await authedClient.billing.checkout.$post();
      if (!res.ok) throw new Error("Failed to create checkout");
      return res.json();
    },
  });
}
