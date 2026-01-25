import type { QueryClient } from "@tanstack/react-query";
import { Link, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { Radio, Archive, Mail, Settings } from "lucide-react";

interface RouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootLayout,
});

function RootLayout() {
	return (
		<div className="min-h-screen bg-zinc-950 text-zinc-100">
			<header className="border-b border-zinc-800 bg-zinc-900">
				<div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
					<Link to="/" className="flex items-center gap-2 text-xl font-bold">
						<Radio className="h-6 w-6 text-green-500" />
						Listen
					</Link>
					<nav className="flex gap-4">
						<NavLink to="/" icon={<Radio className="h-4 w-4" />}>
							Live
						</NavLink>
						<NavLink to="/archive" icon={<Archive className="h-4 w-4" />}>
							Archive
						</NavLink>
						<NavLink to="/subscribe" icon={<Mail className="h-4 w-4" />}>
							Subscribe
						</NavLink>
						<NavLink to="/settings" icon={<Settings className="h-4 w-4" />}>
							Settings
						</NavLink>
					</nav>
				</div>
			</header>
			<main className="mx-auto max-w-4xl px-4 py-8">
				<Outlet />
			</main>
			<footer className="border-t border-zinc-800 py-8">
				<div className="mx-auto max-w-4xl px-4 text-center text-sm text-zinc-500">
					DJ Audio Livestream
				</div>
			</footer>
		</div>
	);
}

function NavLink({
	to,
	icon,
	children,
}: {
	to: string;
	icon: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<Link
			to={to}
			className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-100 [&.active]:text-green-400"
		>
			{icon}
			{children}
		</Link>
	);
}
