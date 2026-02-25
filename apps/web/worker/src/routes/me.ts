import type { Variables } from "../types";
import { Hono } from "hono";

const meRoutes = new Hono<{ Bindings: Env; Variables: Variables }>().get("/", async (c) => {
  const userId = c.get("userId");
  const userEmail = c.get("userEmail");
  const isPremium = c.get("isPremium") ?? false;

  return c.json({
    user: {
      id: userId,
      email: userEmail,
      isPremium,
    },
  });
});

export { meRoutes };
