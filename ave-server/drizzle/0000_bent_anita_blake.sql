CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`action` text NOT NULL,
	`details` text,
	`device_id` text,
	`ip_address` text,
	`user_agent` text,
	`severity` text DEFAULT 'info',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_logs_user_id_idx` ON `activity_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `activity_logs_created_at_idx` ON `activity_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`browser` text,
	`os` text,
	`fingerprint` text,
	`push_subscription` text,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `devices_user_id_idx` ON `devices` (`user_id`);--> statement-breakpoint
CREATE INDEX `devices_fingerprint_idx` ON `devices` (`fingerprint`);--> statement-breakpoint
CREATE TABLE `identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`display_name` text NOT NULL,
	`handle` text NOT NULL,
	`email` text,
	`birthday` text,
	`avatar_url` text,
	`banner_url` text,
	`is_primary` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identities_handle_unique` ON `identities` (`handle`);--> statement-breakpoint
CREATE INDEX `identities_user_id_idx` ON `identities` (`user_id`);--> statement-breakpoint
CREATE INDEX `identities_handle_idx` ON `identities` (`handle`);--> statement-breakpoint
CREATE TABLE `login_requests` (
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
	FOREIGN KEY (`approved_by_device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `login_requests_handle_idx` ON `login_requests` (`handle`);--> statement-breakpoint
CREATE INDEX `login_requests_status_idx` ON `login_requests` (`status`);--> statement-breakpoint
CREATE TABLE `oauth_apps` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon_url` text,
	`website_url` text,
	`client_id` text NOT NULL,
	`client_secret_hash` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`allowed_scopes` text,
	`access_token_ttl_seconds` integer DEFAULT 3600 NOT NULL,
	`refresh_token_ttl_seconds` integer DEFAULT 2592000 NOT NULL,
	`allow_user_id_scope` integer DEFAULT false NOT NULL,
	`supports_e2ee` integer DEFAULT false,
	`owner_id` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_apps_client_id_unique` ON `oauth_apps` (`client_id`);--> statement-breakpoint
CREATE TABLE `oauth_authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`app_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`encrypted_app_key` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_id`) REFERENCES `oauth_apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_authorizations_user_id_idx` ON `oauth_authorizations` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_authorizations_app_id_idx` ON `oauth_authorizations` (`app_id`);--> statement-breakpoint
CREATE TABLE `oauth_refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	`expires_at` integer NOT NULL,
	`user_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`app_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`scope` text NOT NULL,
	`rotated_from_id` text,
	`reuse_detected_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_id`) REFERENCES `oauth_apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_refresh_tokens_token_hash_unique` ON `oauth_refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_user_id_idx` ON `oauth_refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_app_id_idx` ON `oauth_refresh_tokens` (`app_id`);--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_identity_id_idx` ON `oauth_refresh_tokens` (`identity_id`);--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_token_hash_idx` ON `oauth_refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`device_type` text,
	`backed_up` integer DEFAULT false,
	`transports` text,
	`name` text,
	`prf_encrypted_master_key` text,
	`prf_salt` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `passkeys_user_id_idx` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device_id` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`token_hash` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_token_hash_idx` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `signature_requests` (
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
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `signature_requests_identity_id_idx` ON `signature_requests` (`identity_id`);--> statement-breakpoint
CREATE INDEX `signature_requests_app_id_idx` ON `signature_requests` (`app_id`);--> statement-breakpoint
CREATE INDEX `signature_requests_status_idx` ON `signature_requests` (`status`);--> statement-breakpoint
CREATE TABLE `signing_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`public_key` text NOT NULL,
	`encrypted_private_key` text NOT NULL,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signing_keys_identity_id_unique` ON `signing_keys` (`identity_id`);--> statement-breakpoint
CREATE INDEX `signing_keys_identity_id_idx` ON `signing_keys` (`identity_id`);--> statement-breakpoint
CREATE TABLE `trust_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`code_hash` text NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trust_codes_user_id_idx` ON `trust_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`encrypted_master_key_backup` text,
	`security_questions` text
);
