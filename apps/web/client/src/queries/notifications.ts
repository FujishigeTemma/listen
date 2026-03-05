import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import type { SubscribeInput, UnsubscribeInput } from "../../../worker/src/routes/notifications";

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
        const res = await client.notifications.status.$get();
        if (!res.ok) throw new Error("Failed to fetch notification status");
        return res.json();
      },
    }),
};

export function useSubscribeNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubscribeInput) => {
      const client = getClient();
      const res = await client.notifications.subscribe.$post({ json: input });
      if (!res.ok) throw new Error("Failed to subscribe notifications");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: notificationQueries.status().queryKey,
      });
    },
  });
}

export function useUnsubscribeNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UnsubscribeInput) => {
      const client = getClient();
      const res = await client.notifications.unsubscribe.$post({ json: input });
      if (!res.ok) throw new Error("Failed to unsubscribe notifications");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: notificationQueries.status().queryKey,
      });
    },
  });
}
