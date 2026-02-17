CREATE TABLE `oauth_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`owner_app_id` text NOT NULL,
	`resource_key` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text,
	`scopes` text NOT NULL,
	`audience` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`owner_app_id`) REFERENCES `oauth_apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_resources_resource_key_unique` ON `oauth_resources` (`resource_key`);
--> statement-breakpoint
CREATE INDEX `oauth_resources_owner_app_id_idx` ON `oauth_resources` (`owner_app_id`);
--> statement-breakpoint
CREATE INDEX `oauth_resources_status_idx` ON `oauth_resources` (`status`);
--> statement-breakpoint
CREATE TABLE `oauth_delegation_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revoked_at` integer,
	`user_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`source_app_id` text NOT NULL,
	`target_resource_id` text NOT NULL,
	`scope` text NOT NULL,
	`communication_mode` text DEFAULT 'user_present' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_app_id`) REFERENCES `oauth_apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_resource_id`) REFERENCES `oauth_resources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_delegation_grants_user_id_idx` ON `oauth_delegation_grants` (`user_id`);
--> statement-breakpoint
CREATE INDEX `oauth_delegation_grants_source_app_id_idx` ON `oauth_delegation_grants` (`source_app_id`);
--> statement-breakpoint
CREATE INDEX `oauth_delegation_grants_target_resource_id_idx` ON `oauth_delegation_grants` (`target_resource_id`);
--> statement-breakpoint
CREATE INDEX `oauth_delegation_grants_revoked_at_idx` ON `oauth_delegation_grants` (`revoked_at`);
--> statement-breakpoint
CREATE TABLE `oauth_delegation_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`grant_id` text,
	`user_id` text,
	`source_app_id` text,
	`target_resource_id` text,
	`event_type` text NOT NULL,
	`details` text,
	FOREIGN KEY (`grant_id`) REFERENCES `oauth_delegation_grants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_app_id`) REFERENCES `oauth_apps`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_resource_id`) REFERENCES `oauth_resources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `oauth_delegation_audit_logs_grant_id_idx` ON `oauth_delegation_audit_logs` (`grant_id`);
--> statement-breakpoint
CREATE INDEX `oauth_delegation_audit_logs_user_id_idx` ON `oauth_delegation_audit_logs` (`user_id`);
--> statement-breakpoint
CREATE INDEX `oauth_delegation_audit_logs_event_type_idx` ON `oauth_delegation_audit_logs` (`event_type`);
