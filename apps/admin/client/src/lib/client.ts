import type { AppType } from "../../../server/src/index";
import { hc } from "hono/client";

export const client = hc<AppType>("/");
