import type { AppType } from "../../../worker/src/index";
import { hc } from "hono/client";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

export type Client = ReturnType<typeof hc<AppType>>;

let getToken: (() => Promise<string | null>) | undefined = undefined;

export function setGetToken(fn: () => Promise<string | null>) {
  getToken = fn;
}

const client: Client = hc<AppType>(API_BASE, {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (getToken) {
      const token = await getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(input, { ...init, headers });
  },
});

export function useClient(): Client {
  return client;
}
