import { hc } from "hono/client";
import type { AppType } from "../../../server/src/index";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

export const client = hc<AppType>(API_BASE);
