CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`plan` text DEFAULT 'core' NOT NULL,
	`verified_domains` text,
	`app_limit` integer DEFAULT 12 NOT NULL,
	`owner_user_id` text NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);
--> statement-breakpoint
CREATE INDEX `organizations_owner_user_id_idx` ON `organizations` (`owner_user_id`);
--> statement-breakpoint
CREATE INDEX `organizations_slug_idx` ON `organizations` (`slug`);
--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text,
	`invited_email` text,
	`role` text DEFAULT 'admin' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`invited_by_user_id` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `organization_members_organization_id_idx` ON `organization_members` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `organization_members_user_id_idx` ON `organization_members` (`user_id`);
--> statement-breakpoint
CREATE INDEX `organization_members_status_idx` ON `organization_members` (`status`);
--> statement-breakpoint
ALTER TABLE `sessions` ADD `auth_method` text;
--> statement-breakpoint
ALTER TABLE `oauth_apps` ADD `organization_id` text REFERENCES `organizations`(`id`) ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX `oauth_apps_owner_id_idx` ON `oauth_apps` (`owner_id`);
--> statement-breakpoint
CREATE INDEX `oauth_apps_organization_id_idx` ON `oauth_apps` (`organization_id`);
--> statement-breakpoint
INSERT INTO `organizations` (`id`, `created_at`, `updated_at`, `name`, `slug`, `plan`, `verified_domains`, `app_limit`, `owner_user_id`)
SELECT
  lower(hex(randomblob(16))),
  unixepoch('now') * 1000,
  unixepoch('now') * 1000,
  'Workspace',
  'workspace-' || substr(replace(owner_id, '-', ''), 1, 12),
  'core',
  '[]',
  12,
  owner_id
FROM `oauth_apps`
WHERE owner_id IS NOT NULL
GROUP BY owner_id;
--> statement-breakpoint
INSERT INTO `organization_members` (`id`, `created_at`, `updated_at`, `organization_id`, `user_id`, `invited_email`, `role`, `status`, `invited_by_user_id`)
SELECT
  lower(hex(randomblob(16))),
  unixepoch('now') * 1000,
  unixepoch('now') * 1000,
  organizations.id,
  organizations.owner_user_id,
  NULL,
  'owner',
  'active',
  organizations.owner_user_id
FROM `organizations`;
--> statement-breakpoint
UPDATE `oauth_apps`
SET `organization_id` = (
  SELECT organizations.id
  FROM `organizations`
  WHERE organizations.owner_user_id = oauth_apps.owner_id
  LIMIT 1
)
WHERE owner_id IS NOT NULL;
