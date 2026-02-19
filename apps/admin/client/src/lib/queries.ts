import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { client } from "./client";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await client.health.$get();
      if (!res.ok) throw new Error("Failed to fetch health");
      return res.json();
    },
    refetchInterval: 2000,
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const res = await client.api.sessions.$get();
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ["sessions", id],
    queryFn: async () => {
      const res = await client.api.sessions[":id"].$get({ param: { id } });
      if (!res.ok) throw new Error("Failed to fetch session");
      return res.json();
    },
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id?: string; title?: string; scheduledAt?: number }) => {
      const res = await client.api.sessions.$post({ json: data });
      if (!res.ok) throw new Error("Failed to create session");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.sessions[":id"].start.$post({ param: { id } });
      if (!res.ok) throw new Error("Failed to start session");
      return res.json();
    },
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["sessions", id] });
      void queryClient.invalidateQueries({ queryKey: ["health"] });
    },
  });
}

export function useStopSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.sessions[":id"].stop.$post({ param: { id } });
      if (!res.ok) throw new Error("Failed to stop session");
      return res.json();
    },
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["sessions", id] });
      void queryClient.invalidateQueries({ queryKey: ["health"] });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      scheduledAt,
      title,
    }: {
      id: string;
      scheduledAt: number;
      title?: string;
    }) => {
      const res = await client.api.sessions[":id"].schedule.$put({
        param: { id },
        json: { scheduledAt, title },
      });
      if (!res.ok) throw new Error("Failed to update schedule");
      return res.json();
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["sessions", id] });
    },
  });
}

// Tracks queries
export function useTracks(sessionId: string) {
  return useQuery({
    queryKey: ["tracks", sessionId],
    queryFn: async () => {
      const res = await client.api.tracks[":sessionId"].$get({ param: { sessionId } });
      if (!res.ok) throw new Error("Failed to fetch tracks");
      return res.json();
    },
  });
}

export function useCreateTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      ...data
    }: {
      sessionId: string;
      position: number;
      timestampSeconds: number;
      artist?: string;
      title: string;
      label?: string;
    }) => {
      const res = await client.api.tracks[":sessionId"].$post({
        param: { sessionId },
        json: data,
      });
      if (!res.ok) throw new Error("Failed to create track");
      return res.json();
    },
    onSuccess: (_, { sessionId }) => {
      void queryClient.invalidateQueries({ queryKey: ["tracks", sessionId] });
    },
  });
}

export function useUpdateTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      trackId,
      ...data
    }: {
      sessionId: string;
      trackId: number;
      position?: number;
      timestampSeconds?: number;
      artist?: string | null;
      title?: string;
      label?: string | null;
    }) => {
      const res = await client.api.tracks[":sessionId"][":trackId"].$put({
        param: { sessionId, trackId: String(trackId) },
        json: data,
      });
      if (!res.ok) throw new Error("Failed to update track");
      return res.json();
    },
    onSuccess: (_, { sessionId }) => {
      void queryClient.invalidateQueries({ queryKey: ["tracks", sessionId] });
    },
  });
}

export function useDeleteTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, trackId }: { sessionId: string; trackId: number }) => {
      const res = await client.api.tracks[":sessionId"][":trackId"].$delete({
        param: { sessionId, trackId: String(trackId) },
      });
      if (!res.ok) throw new Error("Failed to delete track");
      return res.json();
    },
    onSuccess: (_, { sessionId }) => {
      void queryClient.invalidateQueries({ queryKey: ["tracks", sessionId] });
    },
  });
}
