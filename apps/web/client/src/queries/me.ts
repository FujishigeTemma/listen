import type { Client } from "../lib/client";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { useClient } from "../lib/client";

export const meQueries = {
  all: () => ["me"] as const,

  current: (client: Client) =>
    queryOptions({
      queryKey: meQueries.all(),
      queryFn: async () => {
        const res = await client.me.$get();
        if (!res.ok) throw new Error("Failed to fetch user");
        const data = await res.json();
        return data.user;
      },
    }),
};

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
      void queryClient.invalidateQueries({ queryKey: meQueries.all() });
    },
  });
}
