CREATE TABLE `app_analytics_events` (
  `id` text PRIMARY KEY NOT NULL,
  `created_at` integer NOT NULL,
  `app_id` text NOT NULL REFERENCES oauth_apps(id) ON DELETE cascade,
  `identity_id` text REFERENCES identities(id) ON DELETE set null,
  `event_type` text NOT NULL,
  `auth_method` text,
  `severity` text DEFAULT 'info' NOT NULL,
  `metadata` text
);
--> statement-breakpoint
CREATE INDEX `app_analytics_events_app_id_idx` ON `app_analytics_events` (`app_id`);
--> statement-breakpoint
CREATE INDEX `app_analytics_events_created_at_idx` ON `app_analytics_events` (`created_at`);
--> statement-breakpoint
CREATE INDEX `app_analytics_events_identity_id_idx` ON `app_analytics_events` (`identity_id`);
--> statement-breakpoint
CREATE INDEX `app_analytics_events_event_type_idx` ON `app_analytics_events` (`event_type`);
--> statement-breakpoint
INSERT INTO `app_analytics_events` (`id`, `created_at`, `app_id`, `identity_id`, `event_type`, `auth_method`, `severity`, `metadata`)
SELECT
  lower(hex(randomblob(16))),
  `created_at`,
  `app_id`,
  json_extract(`details`, '$.identityId'),
  `action`,
  json_extract(`details`, '$.authMethod'),
  coalesce(`severity`, 'info'),
  `details`
FROM `activity_logs`
WHERE `app_id` IS NOT NULL
  AND `action` IN ('oauth_authorized', 'oauth_revoked');
