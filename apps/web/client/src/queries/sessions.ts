import { queryOptions } from "@tanstack/react-query";

import { getClient } from "../lib/client";

export const sessionQueries = {
  all: () =>
    queryOptions({
      queryKey: ["sessions"] as const,
    }),

  live: () =>
    queryOptions({
      queryKey: [...sessionQueries.all().queryKey, "live"] as const,
      queryFn: async () => {
        const client = getClient();
        const res = await client.sessions.live.$get();
        if (!res.ok) throw new Error("Failed to fetch live session");
        const data = await res.json();
        return data.session;
      },
      refetchInterval: 10_000,
    }),

  archive: () =>
    queryOptions({
      queryKey: [...sessionQueries.all().queryKey, "archive"] as const,
      queryFn: async () => {
        const client = getClient();
        const res = await client.sessions.archive.$get();
        if (!res.ok) throw new Error("Failed to fetch archive");
        return res.json();
      },
    }),

  detail: (id: string) =>
    queryOptions({
      queryKey: [...sessionQueries.all().queryKey, id] as const,
      queryFn: async () => {
        const client = getClient();
        const res = await client.sessions[":id"].$get({ param: { id } });
        if (!res.ok) throw new Error("Failed to fetch session");
        const data = await res.json();
        return data.session;
      },
    }),
};
