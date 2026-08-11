ALTER TABLE `oauth_refresh_tokens` ADD `family_id` text;
--> statement-breakpoint
WITH RECURSIVE `token_families` (`id`, `family_id`) AS (
  SELECT `id`, `id`
  FROM `oauth_refresh_tokens`
  WHERE `rotated_from_id` IS NULL
  UNION ALL
  SELECT `child`.`id`, `parent`.`family_id`
  FROM `oauth_refresh_tokens` AS `child`
  INNER JOIN `token_families` AS `parent`
    ON `child`.`rotated_from_id` = `parent`.`id`
)
UPDATE `oauth_refresh_tokens`
SET `family_id` = coalesce(
  (SELECT `family_id` FROM `token_families` WHERE `token_families`.`id` = `oauth_refresh_tokens`.`id`),
  `id`
);
--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_family_id_idx`
ON `oauth_refresh_tokens` (`family_id`);
