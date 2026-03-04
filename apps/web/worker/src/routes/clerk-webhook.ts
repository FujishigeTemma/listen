import type { Variables } from "../types";
import type { WebhookEvent } from "@clerk/backend/webhooks";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { users } from "@listen/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import type { DB } from "../lib/db";
import { createDB } from "../lib/db";
import { upsertUser } from "../lib/user";

type UserEvent = Extract<WebhookEvent, { type: "user.created" | "user.updated" }>;

function getPrimaryEmail(evt: UserEvent): string | undefined {
  const primaryId = evt.data.primary_email_address_id;
  return (
    evt.data.email_addresses.find((e) => e.id === primaryId)?.email_address ??
    evt.data.email_addresses[0]?.email_address
  );
}

async function handleEvent(db: DB, evt: WebhookEvent) {
  switch (evt.type) {
    case "user.created":
    case "user.updated": {
      const email = getPrimaryEmail(evt);
      if (email) {
        await upsertUser(db, evt.data.id, email);
      }
      break;
    }
    case "user.deleted": {
      if (evt.data.id) {
        await db.delete(users).where(eq(users.clerkUserId, evt.data.id));
      }
      break;
    }
  }
}

const clerkWebhookRoutes = new Hono<{ Bindings: Env; Variables: Variables }>().post("/", async (c) => {
  const signingSecret = c.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    return c.json({ error: "Webhook not configured" }, 500);
  }

  const evt = await verifyWebhook(c.req.raw, { signingSecret }).catch((error: unknown) => {
    console.error("Clerk webhook verification failed:", error);
    return undefined;
  });
  if (!evt) {
    return c.json({ error: "Verification failed" }, 400);
  }

  await handleEvent(createDB(c.env.DB), evt);

  return c.json({ success: true });
});

export { clerkWebhookRoutes };
