import type { AppType } from "../../../worker/src/index";
import { hc } from "hono/client";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

export type Client = ReturnType<typeof hc<AppType>>;

export function createClient(getToken: () => Promise<string | null>): Client {
  return hc<AppType>(API_BASE, {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const token = await getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    },
  });
}
