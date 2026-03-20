PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`action` text NOT NULL,
	`details` text,
	`app_id` text,
	`device_id` text,
	`ip_address` text,
	`user_agent` text,
	`severity` text DEFAULT 'info',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_id`) REFERENCES `oauth_apps`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_activity_logs`("id", "user_id", "created_at", "action", "details", "app_id", "device_id", "ip_address", "user_agent", "severity") SELECT "id", "user_id", "created_at", "action", "details", "app_id", "device_id", "ip_address", "user_agent", "severity" FROM `activity_logs`;--> statement-breakpoint
DROP TABLE `activity_logs`;--> statement-breakpoint
ALTER TABLE `__new_activity_logs` RENAME TO `activity_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `activity_logs_user_id_idx` ON `activity_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `activity_logs_created_at_idx` ON `activity_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `activity_logs_app_id_idx` ON `activity_logs` (`app_id`);--> statement-breakpoint
CREATE TABLE `__new_login_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`handle` text NOT NULL,
	`device_name` text,
	`device_type` text,
	`browser` text,
	`os` text,
	`fingerprint` text,
	`ip_address` text,
	`requester_public_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`encrypted_master_key` text,
	`approved_by_device_id` text,
	`approver_public_key` text,
	FOREIGN KEY (`approved_by_device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_login_requests`("id", "created_at", "expires_at", "handle", "device_name", "device_type", "browser", "os", "fingerprint", "ip_address", "requester_public_key", "status", "encrypted_master_key", "approved_by_device_id", "approver_public_key") SELECT "id", "created_at", "expires_at", "handle", "device_name", "device_type", "browser", "os", "fingerprint", "ip_address", "requester_public_key", "status", "encrypted_master_key", "approved_by_device_id", "approver_public_key" FROM `login_requests`;--> statement-breakpoint
DROP TABLE `login_requests`;--> statement-breakpoint
ALTER TABLE `__new_login_requests` RENAME TO `login_requests`;--> statement-breakpoint
CREATE INDEX `login_requests_handle_idx` ON `login_requests` (`handle`);--> statement-breakpoint
CREATE INDEX `login_requests_status_idx` ON `login_requests` (`status`);--> statement-breakpoint
CREATE TABLE `__new_signature_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`identity_id` text NOT NULL,
	`app_id` text NOT NULL,
	`payload` text NOT NULL,
	`metadata` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`signature` text,
	`resolved_at` integer,
	`device_id` text,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_id`) REFERENCES `oauth_apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_signature_requests`("id", "created_at", "expires_at", "identity_id", "app_id", "payload", "metadata", "status", "signature", "resolved_at", "device_id") SELECT "id", "created_at", "expires_at", "identity_id", "app_id", "payload", "metadata", "status", "signature", "resolved_at", "device_id" FROM `signature_requests`;--> statement-breakpoint
DROP TABLE `signature_requests`;--> statement-breakpoint
ALTER TABLE `__new_signature_requests` RENAME TO `signature_requests`;--> statement-breakpoint
CREATE INDEX `signature_requests_identity_id_idx` ON `signature_requests` (`identity_id`);--> statement-breakpoint
CREATE INDEX `signature_requests_app_id_idx` ON `signature_requests` (`app_id`);--> statement-breakpoint
CREATE INDEX `signature_requests_status_idx` ON `signature_requests` (`status`);--> statement-breakpoint
DELETE FROM `devices` WHERE `is_active` = 0;
