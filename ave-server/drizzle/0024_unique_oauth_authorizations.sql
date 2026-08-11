UPDATE `oauth_authorizations`
SET
  `created_at` = (
    SELECT min(`duplicate`.`created_at`)
    FROM `oauth_authorizations` AS `duplicate`
    WHERE `duplicate`.`user_id` = `oauth_authorizations`.`user_id`
      AND `duplicate`.`app_id` = `oauth_authorizations`.`app_id`
      AND `duplicate`.`identity_id` = `oauth_authorizations`.`identity_id`
  ),
  `authorization_count` = (
    SELECT sum(`duplicate`.`authorization_count`)
    FROM `oauth_authorizations` AS `duplicate`
    WHERE `duplicate`.`user_id` = `oauth_authorizations`.`user_id`
      AND `duplicate`.`app_id` = `oauth_authorizations`.`app_id`
      AND `duplicate`.`identity_id` = `oauth_authorizations`.`identity_id`
  )
WHERE `id` IN (
  SELECT `keeper`.`id`
  FROM `oauth_authorizations` AS `keeper`
  WHERE `keeper`.`id` = (
    SELECT `latest`.`id`
    FROM `oauth_authorizations` AS `latest`
    WHERE `latest`.`user_id` = `keeper`.`user_id`
      AND `latest`.`app_id` = `keeper`.`app_id`
      AND `latest`.`identity_id` = `keeper`.`identity_id`
    ORDER BY `latest`.`last_authorized_at` DESC, `latest`.`id` DESC
    LIMIT 1
  )
);
--> statement-breakpoint
DELETE FROM `oauth_authorizations`
WHERE `id` NOT IN (
  SELECT `keeper_id`
  FROM (
    SELECT (
      SELECT `latest`.`id`
      FROM `oauth_authorizations` AS `latest`
      WHERE `latest`.`user_id` = `authorization`.`user_id`
        AND `latest`.`app_id` = `authorization`.`app_id`
        AND `latest`.`identity_id` = `authorization`.`identity_id`
      ORDER BY `latest`.`last_authorized_at` DESC, `latest`.`id` DESC
      LIMIT 1
    ) AS `keeper_id`
    FROM `oauth_authorizations` AS `authorization`
  )
);
--> statement-breakpoint
DROP INDEX IF EXISTS `oauth_authorizations_user_app_identity_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_authorizations_user_app_identity_unique`
ON `oauth_authorizations` (`user_id`, `app_id`, `identity_id`);
