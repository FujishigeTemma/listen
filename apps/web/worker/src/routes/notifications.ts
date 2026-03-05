import { vValidator } from "@hono/valibot-validator";
import { notifications } from "@listen/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import type { Variables } from "../types";

import { createDB } from "../lib/db";
import {
  disableNotificationForUser,
  enableNotificationForUser,
  requestNotificationVerificationByEmail,
  unsubscribeByToken,
  verifySubscriptionToken,
} from "../lib/notification-service";

const subscribeSchema = v.variant("mode", [
  v.object({
    mode: v.literal("auth"),
  }),
  v.object({
    mode: v.literal("email"),
    email: v.pipe(v.string(), v.trim(), v.email()),
  }),
]);

const unsubscribeSchema = v.variant("mode", [
  v.object({
    mode: v.literal("auth"),
  }),
  v.object({
    mode: v.literal("token"),
    token: v.pipe(v.string(), v.minLength(1)),
  }),
]);

const oneClickUnsubscribeSchema = v.object({
  "List-Unsubscribe": v.literal("One-Click"),
});

export type SubscribeInput = v.InferInput<typeof subscribeSchema>;
export type UnsubscribeInput = v.InferInput<typeof unsubscribeSchema>;

async function handleSubscribeByEmail(
  db: ReturnType<typeof createDB>,
  email: string,
  requestIp: string,
  publicUrl: string,
  queue: Queue,
) {
  const result = await requestNotificationVerificationByEmail(db, email, requestIp, publicUrl, queue);

  if (!result.ok && result.reason === "rate_limited") {
    return { error: "Too many requests. Please try again later.", status: 429 as const };
  }

  return {
    message: "If your email is valid, a confirmation email has been sent.",
    status: 202 as const,
  };
}

function buildVerifyRedirectUrl(publicUrl: string, token: string | undefined, verified: boolean) {
  const redirectUrl = new URL("/notifications", publicUrl);
  if (!token) {
    redirectUrl.searchParams.set("verified", "0");
    redirectUrl.searchParams.set("reason", "missing_token");
    return redirectUrl;
  }
  redirectUrl.searchParams.set("verified", verified ? "1" : "0");
  if (!verified) {
    redirectUrl.searchParams.set("reason", "invalid_or_expired");
  }
  return redirectUrl;
}

const notificationRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()
  .get("/status", async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ enabled: false, authenticated: false });
    }

    const db = createDB(c.env.DB);
    const notification = await db.query.notifications.findFirst({
      where: eq(notifications.userId, userId),
    });

    return c.json({ enabled: Boolean(notification), authenticated: true });
  })
  .post("/subscribe", vValidator("json", subscribeSchema), async (c) => {
    const body = c.req.valid("json");
    const db = createDB(c.env.DB);

    if (body.mode === "auth") {
      const userId = c.get("userId");
      if (!userId) return c.json({ error: "Unauthorized" }, 401);
      return (await enableNotificationForUser(db, userId))
        ? c.json({ message: "Notifications enabled" }, 201)
        : c.json({ message: "Already enabled" });
    }

    const { PUBLIC_URL: publicUrl } = c.env;
    if (!publicUrl) {
      return c.json({ error: "Notification email is not configured" }, 500);
    }

    return handleSubscribeByEmail(db, body.email, c.req.header("CF-Connecting-IP") ?? "unknown", publicUrl, c.env.NOTIFICATION_EMAIL_QUEUE).then((result) =>
      "error" in result
        ? c.json({ error: result.error }, result.status)
        : c.json({ message: result.message }, result.status),
    );
  })
  .post("/unsubscribe", vValidator("json", unsubscribeSchema), async (c) => {
    const body = c.req.valid("json");
    const db = createDB(c.env.DB);

    if (body.mode === "auth") {
      const userId = c.get("userId");
      if (!userId) return c.json({ error: "Unauthorized" }, 401);
      await disableNotificationForUser(db, userId);
      return c.json({ message: "Notifications disabled" });
    }

    const unsubscribed = await unsubscribeByToken(db, body.token);
    if (!unsubscribed) return c.json({ error: "Invalid or expired token" }, 400);
    return c.json({ message: "Notifications disabled" });
  })
  .post("/unsubscribe/one-click", vValidator("form", oneClickUnsubscribeSchema), async (c) => {
    const token = c.req.query("unsubscribeToken");
    if (!token) return c.text("Missing token", 400);

    await unsubscribeByToken(createDB(c.env.DB), token);
    return c.text("Unsubscribed", 200);
  })
  .get("/verify", async (c) => {
    const publicUrl = c.env.PUBLIC_URL;
    if (!publicUrl) return c.json({ error: "PUBLIC_URL is not configured" }, 500);

    const token = c.req.query("token");
    const db = createDB(c.env.DB);
    const verified = token ? await verifySubscriptionToken(db, token) : false;
    const redirectUrl = buildVerifyRedirectUrl(publicUrl, token, verified);
    return c.redirect(redirectUrl.toString(), 302);
  });

export { notificationRoutes };
