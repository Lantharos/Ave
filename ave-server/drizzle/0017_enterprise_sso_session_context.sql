ALTER TABLE `sessions` ADD `enterprise_sso_organization_id` text REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
ALTER TABLE `sessions` ADD `enterprise_sso_connection_id` text;
--> statement-breakpoint
CREATE INDEX `sessions_enterprise_sso_organization_id_idx` ON `sessions` (`enterprise_sso_organization_id`);
--> statement-breakpoint
ALTER TABLE `oauth_refresh_tokens` ADD `enterprise_sso_organization_id` text REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
ALTER TABLE `oauth_refresh_tokens` ADD `enterprise_sso_connection_id` text;
--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_enterprise_sso_organization_id_idx` ON `oauth_refresh_tokens` (`enterprise_sso_organization_id`);
