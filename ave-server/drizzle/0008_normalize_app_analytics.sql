DELETE FROM `app_analytics_events`
WHERE `event_type` = 'oauth_authorized';
--> statement-breakpoint
UPDATE `app_analytics_events`
SET `event_type` = 'authorization_revoked'
WHERE `event_type` = 'oauth_revoked';
--> statement-breakpoint
INSERT INTO `app_analytics_events` (`id`, `created_at`, `app_id`, `identity_id`, `event_type`, `auth_method`, `severity`, `metadata`)
SELECT
  lower(hex(randomblob(16))),
  `created_at`,
  `app_id`,
  `identity_id`,
  'authorization_added',
  `last_auth_method`,
  'info',
  json_object()
FROM `oauth_authorizations`;
