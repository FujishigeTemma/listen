import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { getClient } from "../lib/client";

export const notificationQueries = {
  all: () =>
    queryOptions({
      queryKey: ["notifications"] as const,
    }),

  status: () =>
    queryOptions({
      queryKey: [...notificationQueries.all().queryKey, "status"] as const,
      queryFn: async () => {
        const client = getClient();
        const res = await client.notifications.$get();
        if (!res.ok) throw new Error("Failed to fetch notification status");
        return res.json();
      },
    }),
};

export function useToggleNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enable: boolean) => {
      const client = getClient();
      if (enable) {
        const res = await client.notifications.$post();
        if (!res.ok) throw new Error("Failed to enable notifications");
      } else {
        const res = await client.notifications.$delete();
        if (!res.ok) throw new Error("Failed to disable notifications");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: notificationQueries.status().queryKey,
      });
    },
  });
}
