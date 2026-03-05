import { hc } from "hono/client";

import type { AppType } from "../../../worker/src/index";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

type Client = ReturnType<typeof hc<AppType>>;

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

export function getClient(): Client {
  return client;
}
