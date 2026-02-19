import { useMutation, useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { client } from "./client";

type TracksResponse = InferResponseType<(typeof client.tracks)[":sessionId"]["$get"]>;
export type Track = TracksResponse extends { tracks: (infer T)[] } ? T : never;

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
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await client.me.$get();
      if (!res.ok) throw new Error("Failed to fetch user");
      const data = await res.json();
      return data.user;
    },
  });
}

export function useBillingStatus() {
  return useQuery({
    queryKey: ["billing", "status"],
    queryFn: async () => {
      const res = await client.billing.status.$get();
      if (!res.ok) throw new Error("Failed to fetch billing status");
      return res.json();
    },
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: async () => {
      const res = await client.billing.checkout.$post();
      if (!res.ok) throw new Error("Failed to create checkout");
      return res.json();
    },
  });
}
