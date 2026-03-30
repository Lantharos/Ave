CREATE TABLE `identity_encryption_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`public_key` text NOT NULL,
	`encrypted_private_key` text NOT NULL,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_encryption_keys_identity_id_unique` ON `identity_encryption_keys` (`identity_id`);
--> statement-breakpoint
CREATE INDEX `identity_encryption_keys_identity_id_idx` ON `identity_encryption_keys` (`identity_id`);
--> statement-breakpoint
CREATE TABLE `shared_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`owner_identity_id` text NOT NULL,
	`kind` text NOT NULL,
	`app_id` text,
	`resource_key` text,
	`label` text,
	`status` text NOT NULL DEFAULT 'active',
	FOREIGN KEY (`owner_identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`app_id`) REFERENCES `oauth_apps`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `shared_secrets_owner_identity_id_idx` ON `shared_secrets` (`owner_identity_id`);
--> statement-breakpoint
CREATE INDEX `shared_secrets_app_id_idx` ON `shared_secrets` (`app_id`);
--> statement-breakpoint
CREATE INDEX `shared_secrets_kind_idx` ON `shared_secrets` (`kind`);
--> statement-breakpoint
CREATE TABLE `shared_secret_access` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`shared_secret_id` text NOT NULL,
	`recipient_identity_id` text NOT NULL,
	`encrypted_secret_for_recipient` text NOT NULL,
	`claimed_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`shared_secret_id`) REFERENCES `shared_secrets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shared_secret_access_shared_secret_id_idx` ON `shared_secret_access` (`shared_secret_id`);
--> statement-breakpoint
CREATE INDEX `shared_secret_access_recipient_identity_id_idx` ON `shared_secret_access` (`recipient_identity_id`);
--> statement-breakpoint
CREATE TABLE `shared_secret_transfer_contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`shared_secret_id` text NOT NULL,
	`owner_identity_id` text NOT NULL,
	`target_handle` text NOT NULL,
	`target_identity_id` text,
	`claim_token_hash` text NOT NULL,
	`encrypted_secret_for_target` text NOT NULL,
	`sender_public_key` text NOT NULL,
	`return_url` text,
	`status` text NOT NULL DEFAULT 'pending',
	`claimed_at` integer,
	FOREIGN KEY (`shared_secret_id`) REFERENCES `shared_secrets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shared_secret_transfer_contracts_claim_token_hash_unique` ON `shared_secret_transfer_contracts` (`claim_token_hash`);
--> statement-breakpoint
CREATE INDEX `shared_secret_transfer_contracts_shared_secret_id_idx` ON `shared_secret_transfer_contracts` (`shared_secret_id`);
--> statement-breakpoint
CREATE INDEX `shared_secret_transfer_contracts_owner_identity_id_idx` ON `shared_secret_transfer_contracts` (`owner_identity_id`);
--> statement-breakpoint
CREATE INDEX `shared_secret_transfer_contracts_target_handle_idx` ON `shared_secret_transfer_contracts` (`target_handle`);
--> statement-breakpoint
CREATE INDEX `shared_secret_transfer_contracts_status_idx` ON `shared_secret_transfer_contracts` (`status`);
