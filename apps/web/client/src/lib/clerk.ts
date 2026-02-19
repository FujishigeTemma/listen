// Clerk utilities - stub for now
// TODO: Implement Clerk integration

export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function isAuthEnabled(): boolean {
  return Boolean(CLERK_PUBLISHABLE_KEY);
}
