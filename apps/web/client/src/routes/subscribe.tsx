import { createFileRoute } from "@tanstack/react-router";
import { Mail, Bell, Check } from "lucide-react";
import { useState } from "react";
import { useSubscribe } from "../lib/queries";

export const Route = createFileRoute("/subscribe")({
	component: SubscribePage,
});

function SubscribePage() {
	const [email, setEmail] = useState("");
	const [notifyLive, setNotifyLive] = useState(true);
	const [notifyScheduled, setNotifyScheduled] = useState(true);
	const [success, setSuccess] = useState(false);
	const subscribe = useSubscribe();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		subscribe.mutate(
			{ email, notifyLive, notifyScheduled },
			{
				onSuccess: () => {
					setSuccess(true);
					setEmail("");
				},
			}
		);
	};

	return (
		<div className="space-y-8">
			<div>
				<h1 className="flex items-center gap-2 text-2xl font-bold">
					<Mail className="h-6 w-6" />
					Subscribe
				</h1>
				<p className="mt-1 text-zinc-500">
					Get notified when a new stream starts
				</p>
			</div>

			{success ? (
				<div className="rounded-lg border border-green-800 bg-green-950/50 p-6 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-600">
						<Check className="h-6 w-6" />
					</div>
					<h2 className="text-lg font-semibold">You're subscribed!</h2>
					<p className="mt-1 text-zinc-400">
						You'll receive notifications based on your preferences.
					</p>
					<button
						onClick={() => setSuccess(false)}
						className="mt-4 text-sm text-green-400 hover:text-green-300"
					>
						Subscribe another email
					</button>
				</div>
			) : (
				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label htmlFor="email" className="block text-sm font-medium text-zinc-300">
							Email address
						</label>
						<input
							type="email"
							id="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							placeholder="you@example.com"
							className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
						/>
					</div>

					<div className="space-y-3">
						<label className="block text-sm font-medium text-zinc-300">
							Notification preferences
						</label>
						<div className="space-y-2">
							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={notifyLive}
									onChange={(e) => setNotifyLive(e.target.checked)}
									className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-green-600 focus:ring-green-500"
								/>
								<span className="flex items-center gap-2">
									<Bell className="h-4 w-4 text-zinc-400" />
									Notify when stream goes live
								</span>
							</label>
							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={notifyScheduled}
									onChange={(e) => setNotifyScheduled(e.target.checked)}
									className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-green-600 focus:ring-green-500"
								/>
								<span className="flex items-center gap-2">
									<Mail className="h-4 w-4 text-zinc-400" />
									Notify about scheduled sessions
								</span>
							</label>
						</div>
					</div>

					{subscribe.error && (
						<div className="text-sm text-red-400">
							Something went wrong. Please try again.
						</div>
					)}

					<button
						type="submit"
						disabled={subscribe.isPending}
						className="w-full rounded-lg bg-green-600 py-2 font-medium hover:bg-green-700 disabled:opacity-50"
					>
						{subscribe.isPending ? "Subscribing..." : "Subscribe"}
					</button>
				</form>
			)}
		</div>
	);
}
