import type { AppType } from "../../../worker/src/index";
import { hc } from "hono/client";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

export const client = hc<AppType>(API_BASE);
