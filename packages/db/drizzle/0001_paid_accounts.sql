-- Drop old tables
DROP TABLE IF EXISTS `subscribers`;--> statement-breakpoint
-- Recreate users table with new schema
CREATE TABLE `users_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`clerk_user_id` text,
	`polar_customer_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);--> statement-breakpoint
-- Migrate existing user data
INSERT INTO `users_new` (`email`, `clerk_user_id`, `created_at`, `updated_at`)
SELECT `email`, `id`, `created_at`, `created_at` FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `users_new` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_clerk_user_id_unique` ON `users` (`clerk_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_polar_customer_id_unique` ON `users` (`polar_customer_id`);--> statement-breakpoint
-- Create subscriptions table
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
);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_polar_subscription_id_unique` ON `subscriptions` (`polar_subscription_id`);--> statement-breakpoint
-- Create notifications table
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_user_id_unique` ON `notifications` (`user_id`);
