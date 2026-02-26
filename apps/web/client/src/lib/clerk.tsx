import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { useNavigate } from "@tanstack/react-router";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      routerPush={(to) => navigate({ to })}
      routerReplace={(to) => navigate({ to, replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}
