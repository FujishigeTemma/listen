import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { getClient } from "../lib/client";

export const meQueries = {
  all: () =>
    queryOptions({
      queryKey: ["me"] as const,
    }),

  current: () =>
    queryOptions({
      queryKey: meQueries.all().queryKey,
      queryFn: async () => {
        const client = getClient();
        const res = await client.me.$get();
        if (!res.ok) throw new Error("Failed to fetch user");
        const data = await res.json();
        return data.user;
      },
    }),
};

export function useSyncUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const client = getClient();
      const res = await client.me.sync.$post();
      if (!res.ok) throw new Error("Failed to sync user");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: meQueries.all().queryKey,
      });
    },
  });
}
