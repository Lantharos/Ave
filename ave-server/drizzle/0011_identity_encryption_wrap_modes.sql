ALTER TABLE `identity_encryption_keys` ADD `wrap_mode` text;
--> statement-breakpoint
ALTER TABLE `identity_encryption_keys` ADD `oauth_app_id` text REFERENCES `oauth_apps`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
CREATE TABLE `identity_encryption_oauth_wraps` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_id` text NOT NULL,
	`oauth_app_id` text NOT NULL,
	`device_key` text NOT NULL DEFAULT 'default',
	`created_at` integer NOT NULL,
	`encrypted_private_key` text NOT NULL,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`oauth_app_id`) REFERENCES `oauth_apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_encryption_oauth_wraps_identity_oauth_device_unique` ON `identity_encryption_oauth_wraps` (`identity_id`,`oauth_app_id`,`device_key`);
--> statement-breakpoint
CREATE INDEX `identity_encryption_oauth_wraps_identity_id_idx` ON `identity_encryption_oauth_wraps` (`identity_id`);
--> statement-breakpoint
CREATE INDEX `identity_encryption_oauth_wraps_oauth_app_id_idx` ON `identity_encryption_oauth_wraps` (`oauth_app_id`);
