import { queryOptions, useMutation } from "@tanstack/react-query";

import { getClient } from "../lib/client";

export const billingQueries = {
  all: () =>
    queryOptions({
      queryKey: ["billing"] as const,
    }),

  status: () =>
    queryOptions({
      queryKey: [...billingQueries.all().queryKey, "status"] as const,
      queryFn: async () => {
        const client = getClient();
        const res = await client.billing.status.$get();
        if (!res.ok) throw new Error("Failed to fetch billing status");
        return res.json();
      },
    }),
};

export function useCreateCheckout() {
  return useMutation({
    mutationFn: async () => {
      const client = getClient();
      const res = await client.billing.checkout.$post();
      if (!res.ok) throw new Error("Failed to create checkout");
      return res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
  });
}
