ALTER TABLE `organizations` ADD `sso_required` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `oauth_refresh_tokens` ADD `organization_id` text REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_organization_id_idx` ON `oauth_refresh_tokens` (`organization_id`);
--> statement-breakpoint
CREATE TABLE `organization_identity_members` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`organization_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`added_by_user_id` text,
	`added_by_identity_id` text,
	`role` text DEFAULT 'member' NOT NULL,
	`scopes` text,
	`signing_authority` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`added_by_identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_identity_members_org_identity_unique` ON `organization_identity_members` (`organization_id`,`identity_id`);
--> statement-breakpoint
CREATE INDEX `organization_identity_members_organization_id_idx` ON `organization_identity_members` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `organization_identity_members_identity_id_idx` ON `organization_identity_members` (`identity_id`);
--> statement-breakpoint
CREATE INDEX `organization_identity_members_status_idx` ON `organization_identity_members` (`status`);
--> statement-breakpoint
ALTER TABLE `oauth_refresh_tokens` ADD `organization_member_id` text REFERENCES `organization_identity_members`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
CREATE TABLE `organization_keyrings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`resource` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text,
	`created_by_identity_id` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `organization_keyrings_organization_id_idx` ON `organization_keyrings` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `organization_keyrings_status_idx` ON `organization_keyrings` (`status`);
--> statement-breakpoint
CREATE TABLE `organization_key_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`organization_id` text NOT NULL,
	`keyring_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`sender_public_key` text NOT NULL,
	`recipient_public_key` text NOT NULL,
	`wrap_version` text DEFAULT 'p256-aesgcm-v1' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`keyring_id`) REFERENCES `organization_keyrings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_key_grants_keyring_identity_unique` ON `organization_key_grants` (`keyring_id`,`identity_id`);
--> statement-breakpoint
CREATE INDEX `organization_key_grants_organization_id_idx` ON `organization_key_grants` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `organization_key_grants_keyring_id_idx` ON `organization_key_grants` (`keyring_id`);
--> statement-breakpoint
CREATE INDEX `organization_key_grants_identity_id_idx` ON `organization_key_grants` (`identity_id`);
--> statement-breakpoint
CREATE TABLE `organization_sso_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`organization_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text DEFAULT 'generic' NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`metadata_url` text,
	`entity_id` text,
	`sso_url` text,
	`x509_certificate` text,
	`issuer` text,
	`authorization_endpoint` text,
	`token_endpoint` text,
	`jwks_uri` text,
	`client_id` text,
	`encrypted_client_secret` text,
	`attribute_mappings` text,
	`key_access_mode` text DEFAULT 'ave_identity_keys' NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `organization_sso_connections_organization_id_idx` ON `organization_sso_connections` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `organization_sso_connections_status_idx` ON `organization_sso_connections` (`status`);
--> statement-breakpoint
CREATE INDEX `organization_sso_connections_domain_idx` ON `organization_sso_connections` (`domain`);
--> statement-breakpoint
CREATE TABLE `organization_domain_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`organization_id` text NOT NULL,
	`domain` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`verified_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_domain_verifications_org_domain_unique` ON `organization_domain_verifications` (`organization_id`,`domain`);
--> statement-breakpoint
CREATE INDEX `organization_domain_verifications_domain_idx` ON `organization_domain_verifications` (`domain`);
--> statement-breakpoint
CREATE INDEX `organization_domain_verifications_status_idx` ON `organization_domain_verifications` (`status`);
--> statement-breakpoint
CREATE TABLE `organization_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`organization_id` text NOT NULL,
	`actor_user_id` text,
	`actor_identity_id` text,
	`target_identity_id` text,
	`action` text NOT NULL,
	`details` text,
	`signature_payload` text,
	`signature` text,
	`signature_public_key` text,
	`signature_status` text DEFAULT 'not_provided' NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`severity` text DEFAULT 'info' NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `organization_audit_events_organization_id_idx` ON `organization_audit_events` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `organization_audit_events_actor_identity_id_idx` ON `organization_audit_events` (`actor_identity_id`);
--> statement-breakpoint
CREATE INDEX `organization_audit_events_created_at_idx` ON `organization_audit_events` (`created_at`);
