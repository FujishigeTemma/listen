import type { Client } from "../lib/client";
import { useClient } from "../lib/client";
import { queryOptions, useMutation } from "@tanstack/react-query";

export const billingQueries = {
  all: () => ["billing"] as const,

  status: (client: Client) =>
    queryOptions({
      queryKey: [...billingQueries.all(), "status"] as const,
      queryFn: async () => {
        const res = await client.billing.status.$get();
        if (!res.ok) throw new Error("Failed to fetch billing status");
        return res.json();
      },
    }),
};

export function useCreateCheckout() {
  const client = useClient();
  return useMutation({
    mutationFn: async () => {
      const res = await client.billing.checkout.$post();
      if (!res.ok) throw new Error("Failed to create checkout");
      return res.json();
    },
  });
}
