import type { ReactNode } from "react";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";

export const CLERK_PUBLISHABLE_KEY: string | undefined = import.meta.env
  .VITE_CLERK_PUBLISHABLE_KEY;

export function isAuthEnabled(): boolean {
  return Boolean(CLERK_PUBLISHABLE_KEY);
}

/**
 * Wraps children with ClerkProvider only if a publishable key is configured.
 * When no key is set, auth features are simply unavailable.
 */
export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  if (!CLERK_PUBLISHABLE_KEY) {
    return children;
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      routerPush={(to) => window.history.pushState({}, "", to)}
      routerReplace={(to) => window.history.replaceState({}, "", to)}
    >
      {children}
    </ClerkProvider>
  );
}

/**
 * Returns a getToken function if the user is signed in, or undefined otherwise.
 * Safe to call even when ClerkProvider is absent (returns undefined).
 */
export function useAuthToken(): (() => Promise<string | null>) | undefined {
  if (!CLERK_PUBLISHABLE_KEY) {
    return undefined;
  }

  // This is safe because ClerkProvider is guaranteed to be present
  // When CLERK_PUBLISHABLE_KEY is set (via AuthProvider).
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const { getToken, isSignedIn } = useAuth();
  if (!isSignedIn) {
    return undefined;
  }
  return getToken;
}
