CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`state` text DEFAULT 'scheduled' NOT NULL,
	`scheduled_at` integer,
	`started_at` integer,
	`ended_at` integer,
	`expires_at` integer,
	`duration_seconds` integer
);
--> statement-breakpoint
CREATE TABLE `subscribers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`notify_live` integer DEFAULT true NOT NULL,
	`notify_scheduled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_email_unique` ON `subscribers` (`email`);--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`position` integer NOT NULL,
	`timestamp_seconds` integer NOT NULL,
	`artist` text,
	`title` text NOT NULL,
	`label` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`is_premium` integer DEFAULT false NOT NULL,
	`premium_expires_at` integer,
	`created_at` integer NOT NULL
);
