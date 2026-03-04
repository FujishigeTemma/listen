import type { Client } from "../lib/client";
import { queryOptions } from "@tanstack/react-query";

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
  all: () => ["tracks"] as const,

  bySession: (client: Client, sessionId: string) =>
    queryOptions({
      queryKey: [...trackQueries.all(), sessionId] as const,
      queryFn: async () => {
        const res = await client.tracks[":sessionId"].$get({ param: { sessionId } });
        if (!res.ok) throw new Error("Failed to fetch tracks");
        return res.json();
      },
    }),
};
