ALTER TABLE `organization_keyrings` ADD `encryption_mode` text DEFAULT 'e2ee' NOT NULL;
--> statement-breakpoint
ALTER TABLE `organization_keyrings` ADD `epoch` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `organization_keyrings` ADD `rotated_from_keyring_id` text;
--> statement-breakpoint
ALTER TABLE `organization_keyrings` ADD `key_provider_ref` text;
--> statement-breakpoint
CREATE INDEX `organization_keyrings_rotated_from_idx` ON `organization_keyrings` (`rotated_from_keyring_id`);
--> statement-breakpoint
ALTER TABLE `organization_key_grants` ADD `revoked_at` integer;
--> statement-breakpoint
CREATE TABLE `organization_encryption_policies` (
  `id` text PRIMARY KEY NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `organization_id` text NOT NULL,
  `mode` text DEFAULT 'standard' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `kms_provider` text,
  `kms_key_ref` text,
  `kms_key_version` text,
  `require_identity_keys` integer DEFAULT 0 NOT NULL,
  `rotated_at` integer,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_encryption_policies_org_unique` ON `organization_encryption_policies` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `organization_encryption_policies_mode_idx` ON `organization_encryption_policies` (`mode`);
