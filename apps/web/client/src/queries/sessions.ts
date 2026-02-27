import type { Client } from "../lib/client";
import { queryOptions } from "@tanstack/react-query";

export const sessionQueries = {
  all: () => ["sessions"] as const,

  live: (client: Client) =>
    queryOptions({
      queryKey: [...sessionQueries.all(), "live"] as const,
      queryFn: async () => {
        const res = await client.sessions.live.$get();
        if (!res.ok) throw new Error("Failed to fetch live session");
        const data = await res.json();
        return data.session;
      },
      refetchInterval: 10_000,
    }),

  archive: (client: Client) =>
    queryOptions({
      queryKey: [...sessionQueries.all(), "archive"] as const,
      queryFn: async () => {
        const res = await client.sessions.archive.$get();
        if (!res.ok) throw new Error("Failed to fetch archive");
        const data = await res.json();
        return data.sessions;
      },
    }),

  detail: (client: Client, id: string) =>
    queryOptions({
      queryKey: [...sessionQueries.all(), id] as const,
      queryFn: async () => {
        const res = await client.sessions[":id"].$get({ param: { id } });
        if (!res.ok) throw new Error("Failed to fetch session");
        const data = await res.json();
        return data.session;
      },
    }),
};
