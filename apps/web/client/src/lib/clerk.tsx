import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/clerk-react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      routerPush={(to) => window.history.pushState({}, "", to)}
      routerReplace={(to) => window.history.replaceState({}, "", to)}
    >
      {children}
    </ClerkProvider>
  );
}
