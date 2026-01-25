import { createMiddleware } from "hono/factory";
import type { Env, Variables } from "../types";

// Stub auth middleware - will be replaced with Clerk integration
export const authMiddleware = createMiddleware<{
	Bindings: Env;
	Variables: Variables;
}>(async (_c, next) => {
	// For now, just pass through without auth
	// TODO: Implement Clerk auth
	await next();
});

// Optional auth - doesn't require authentication but extracts user if present
export const optionalAuthMiddleware = createMiddleware<{
	Bindings: Env;
	Variables: Variables;
}>(async (_c, next) => {
	// For now, just pass through
	// TODO: Extract user from Clerk token if present
	await next();
});

// Require premium subscription
export const premiumMiddleware = createMiddleware<{
	Bindings: Env;
	Variables: Variables;
}>(async (_c, next) => {
	// For now, just pass through
	// TODO: Check premium status
	await next();
});
