import { handleQueue } from "./handlers/consumer.ts";
import { handleScheduled } from "./handlers/scheduler.ts";
import { handleResendWebhook } from "./handlers/webhook.ts";
import type { EmailQueueMessage, Env } from "./lib/types.ts";

export type { EmailQueueMessage } from "./lib/types.ts";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/webhooks/resend") {
      return handleResendWebhook(request, env);
    }
    return new Response("Not found", { status: 404 });
  },

  async scheduled(_controller, env) {
    await handleScheduled(env);
  },

  async queue(batch, env) {
    await handleQueue(batch, env);
  },
} satisfies ExportedHandler<Env, EmailQueueMessage>;
