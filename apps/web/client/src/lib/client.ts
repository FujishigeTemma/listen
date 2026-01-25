import { hc } from "hono/client";
import type { AppType } from "../../../worker/src/index";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

export const client = hc<AppType>(API_BASE, {
	fetch: (input: RequestInfo | URL, init?: RequestInit) =>
		fetch(input, {
			...init,
			credentials: "include",
		}),
});
