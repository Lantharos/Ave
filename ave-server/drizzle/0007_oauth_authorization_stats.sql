ALTER TABLE `oauth_authorizations` ADD `last_authorized_at` integer;
--> statement-breakpoint
ALTER TABLE `oauth_authorizations` ADD `authorization_count` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `oauth_authorizations` ADD `last_auth_method` text;
--> statement-breakpoint
CREATE INDEX `oauth_authorizations_identity_id_idx` ON `oauth_authorizations` (`identity_id`);
--> statement-breakpoint
UPDATE `oauth_authorizations`
SET `last_authorized_at` = `created_at`
WHERE `last_authorized_at` IS NULL;
