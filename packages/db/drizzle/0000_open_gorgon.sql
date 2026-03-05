CREATE TABLE `email_suppressions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`reason` text NOT NULL,
	`source_email_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_suppressions_email_unique` ON `email_suppressions` (`email`);--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_retry_at` integer,
	`last_error` text,
	`queued_at` integer NOT NULL,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `notification_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_deliveries_event_user_unique` ON `notification_deliveries` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_status_next_retry_at_idx` ON `notification_deliveries` (`status`,`next_retry_at`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_event_id_status_idx` ON `notification_deliveries` (`event_id`,`status`);--> statement-breakpoint
CREATE TABLE `notification_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_key` text NOT NULL,
	`event_type` text NOT NULL,
	`session_id` text NOT NULL,
	`session_state` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_events_event_key_unique` ON `notification_events` (`event_key`);--> statement-breakpoint
CREATE INDEX `notification_events_event_type_occurred_at_idx` ON `notification_events` (`event_type`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `notification_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL,
	`purpose` text NOT NULL,
	`request_ip` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_tokens_token_hash_unique` ON `notification_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `notification_tokens_email_created_at_idx` ON `notification_tokens` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `notification_tokens_request_ip_created_at_idx` ON `notification_tokens` (`request_ip`,`created_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_user_id_unique` ON `notifications` (`user_id`);--> statement-breakpoint
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
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`polar_subscription_id` text NOT NULL,
	`polar_product_id` text NOT NULL,
	`status` text NOT NULL,
	`current_period_start` integer,
	`current_period_end` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_polar_subscription_id_unique` ON `subscriptions` (`polar_subscription_id`);--> statement-breakpoint
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
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`clerk_user_id` text,
	`polar_customer_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_clerk_user_id_unique` ON `users` (`clerk_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_polar_customer_id_unique` ON `users` (`polar_customer_id`);