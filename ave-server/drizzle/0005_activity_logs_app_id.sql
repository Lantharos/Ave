ALTER TABLE `activity_logs` ADD `app_id` text REFERENCES oauth_apps(id) ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `activity_logs_app_id_idx` ON `activity_logs` (`app_id`);
--> statement-breakpoint
UPDATE `activity_logs`
SET `app_id` = json_extract(`details`, '$.appId')
WHERE `app_id` IS NULL
  AND json_extract(`details`, '$.appId') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM `oauth_apps`
    WHERE `oauth_apps`.`id` = json_extract(`activity_logs`.`details`, '$.appId')
  );
