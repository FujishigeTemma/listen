import type { QueryClient } from "@tanstack/react-query";
import { SignedIn, SignedOut, UserButton, SignInButton } from "@clerk/clerk-react";
import { Link, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { Radio, Archive, Mail, Settings, LogIn } from "lucide-react";
import { useEffect } from "react";

import { isAuthEnabled } from "../lib/clerk";
import { useSyncUser } from "../lib/queries";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-4xl px-4 text-center text-sm text-zinc-500">
          DJ Audio Livestream
        </div>
      </footer>
      <UserSync />
    </div>
  );
}

/** Syncs the Clerk user to the database after sign-in. */
function UserSync() {
  if (!isAuthEnabled()) return <></>;
  return (
    <SignedIn>
      <UserSyncInner />
    </SignedIn>
  );
}

function UserSyncInner() {
  const sync = useSyncUser();

  useEffect(() => {
    sync.mutate();
    // Run once on mount
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <></>;
}

function Header() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-900">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold">
          <Radio className="h-6 w-6 text-green-500" />
          Listen
        </Link>
        <div className="flex items-center gap-4">
          <Navigation />
          <AuthSection />
        </div>
      </div>
    </header>
  );
}

function Navigation() {
  return (
    <nav className="flex gap-4">
      <NavLink to="/" label="Live" icon={Radio} />
      <NavLink to="/archive" label="Archive" icon={Archive} />
      <NavLink to="/subscribe" label="Subscribe" icon={Mail} />
      <NavLink to="/settings" label="Settings" icon={Settings} />
    </nav>
  );
}

function AuthSection() {
  if (!isAuthEnabled()) return <></>;

  return (
    <div className="flex items-center">
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            <LogIn className="h-4 w-4" />
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-100 [&.active]:text-green-400"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
