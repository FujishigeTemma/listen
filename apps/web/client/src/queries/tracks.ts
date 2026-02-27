import type { Client } from "../lib/client";
import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

type TracksResponse = InferResponseType<Client["tracks"][":sessionId"]["$get"]>;
export type Track = TracksResponse extends { tracks: (infer T)[] } ? T : never;

export const trackQueries = {
  all: () => ["tracks"] as const,

  bySession: (client: Client, sessionId: string) =>
    queryOptions({
      queryKey: [...trackQueries.all(), sessionId] as const,
      queryFn: async () => {
        const res = await client.tracks[":sessionId"].$get({ param: { sessionId } });
        if (!res.ok) throw new Error("Failed to fetch tracks");
        const data = await res.json();
        return data.tracks;
      },
    }),
};
