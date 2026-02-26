import type { Variables } from "../types";
import type { Context } from "hono";
import { users } from "@listen/db";
import { verifyToken } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { createDB } from "../lib/db";

type AuthContext = Context<{ Bindings: Env; Variables: Variables }>;

/** Verify the Clerk JWT and return the payload, or undefined on failure. */
async function verifyClerkToken(token: string, secretKey: string) {
  const payload = await verifyToken(token, { secretKey });
  return payload.sub ? payload : undefined;
}

/** Extract email claim from the JWT payload. */
function extractEmailClaim(payload: Record<string, unknown>): string | undefined {
  const email = payload.email ?? payload.primary_email;
  return typeof email === "string" ? email : undefined;
}

/** Populate context variables from verified token payload and DB lookup. */
async function populateUserContext(c: AuthContext, payload: { sub: string }) {
  c.set("userId", payload.sub);

  const email = extractEmailClaim(payload as Record<string, unknown>);
  if (email) c.set("userEmail", email);

  const db = createDB(c.env.DB);
  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.sub),
  });

  if (user) {
    c.set("userEmail", user.email);
    const now = Math.floor(Date.now() / 1000);
    c.set("isPremium", user.isPremium && (!user.premiumExpiresAt || user.premiumExpiresAt > now));
  }
}

/** Extract the Bearer token from the Authorization header. */
function extractBearerToken(c: AuthContext): string | undefined {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  return authHeader.slice(7);
}

/**
 * Extracts and verifies the Clerk JWT from the Authorization header.
 * If valid, sets userId, userEmail, and isPremium on the context.
 * This middleware never blocks the request — unauthenticated users simply
 * have no userId set.
 */
export const optionalAuthMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const token = extractBearerToken(c);
  const secretKey = c.env.CLERK_SECRET_KEY;
  if (!token || !secretKey) return next();

  try {
    const payload = await verifyClerkToken(token, secretKey);
    if (payload) await populateUserContext(c, payload);
  } catch {
    // Token verification failed — treat as unauthenticated
  }

  return next();
});

/**
 * Requires a valid Clerk JWT. Returns 401 if not authenticated.
 */
export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const token = extractBearerToken(c);
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const secretKey = c.env.CLERK_SECRET_KEY;
  if (!secretKey) return c.json({ error: "Auth not configured" }, 500);

  try {
    const payload = await verifyClerkToken(token, secretKey);
    if (!payload) return c.json({ error: "Unauthorized" }, 401);
    await populateUserContext(c, payload);
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }

  return next();
});

/**
 * Requires premium subscription. Must be used after authMiddleware.
 */
export const premiumMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  if (!c.get("isPremium")) {
    return c.json({ error: "Premium subscription required" }, 403);
  }
  return next();
});
