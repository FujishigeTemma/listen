import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import type { InferResponseType } from "hono/client";

import type { Client } from "./client";
import { createClient } from "./client";

type TracksResponse = InferResponseType<Client["tracks"][":sessionId"]["$get"]>;
export type Track = TracksResponse extends { tracks: (infer T)[] } ? T : never;

function useClient() {
  const { getToken } = useAuth();
  return createClient(getToken);
}

export function useLiveSession() {
  const client = useClient();
  return useQuery({
    queryKey: ["sessions", "live"],
    queryFn: async () => {
      const res = await client.sessions.live.$get();
      if (!res.ok) throw new Error("Failed to fetch live session");
      const data = await res.json();
      return data.session;
    },
    refetchInterval: 10_000,
  });
}

export function useArchiveSessions() {
  const client = useClient();
  return useQuery({
    queryKey: ["sessions", "archive"],
    queryFn: async () => {
      const res = await client.sessions.archive.$get();
      if (!res.ok) throw new Error("Failed to fetch archive");
      const data = await res.json();
      return data.sessions;
    },
  });
}

export function useSession(id: string) {
  const client = useClient();
  return useQuery({
    queryKey: ["sessions", id],
    queryFn: async () => {
      const res = await client.sessions[":id"].$get({ param: { id } });
      if (!res.ok) throw new Error("Failed to fetch session");
      const data = await res.json();
      return data.session;
    },
  });
}

export function useTracks(sessionId: string) {
  const client = useClient();
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
  const client = useClient();
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
  const client = useClient();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await client.me.$get();
      if (!res.ok) throw new Error("Failed to fetch user");
      const data = await res.json();
      return data.user;
    },
    enabled: Boolean(isSignedIn),
  });
}

export function useSyncUser() {
  const client = useClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await client.me.sync.$post();
      if (!res.ok) throw new Error("Failed to sync user");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useBillingStatus() {
  const client = useClient();
  const { isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["billing", "status"],
    queryFn: async () => {
      const res = await client.billing.status.$get();
      if (!res.ok) throw new Error("Failed to fetch billing status");
      return res.json();
    },
    enabled: Boolean(isSignedIn),
  });
}

export function useCreateCheckout() {
  const client = useClient();
  return useMutation({
    mutationFn: async () => {
      const res = await client.billing.checkout.$post();
      if (!res.ok) throw new Error("Failed to create checkout");
      return res.json();
    },
  });
}
