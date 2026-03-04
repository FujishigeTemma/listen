import { queryOptions } from "@tanstack/react-query";

import { getClient } from "../lib/client";

export interface Track {
  id: number;
  position: number;
  timestampSeconds: number;
  artist: string | null;
  title: string;
  label: string | null;
  sessionId: string;
}

export const trackQueries = {
  all: () =>
    queryOptions({
      queryKey: ["tracks"] as const,
    }),

  bySession: (sessionId: string) =>
    queryOptions({
      queryKey: [...trackQueries.all().queryKey, sessionId] as const,
      queryFn: async () => {
        const client = getClient();
        const res = await client.tracks[":sessionId"].$get({
          param: { sessionId },
        });
        if (!res.ok) throw new Error("Failed to fetch tracks");
        return res.json();
      },
    }),
};
