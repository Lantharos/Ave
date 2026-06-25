ALTER TABLE `oauth_authorizations` ADD `app_public_key` text;
ALTER TABLE `oauth_authorizations` ADD `encrypted_app_private_key` text;
ALTER TABLE `oauth_authorizations` ADD `app_encryption_mode` text;

CREATE INDEX `oauth_authorizations_app_public_key_idx` ON `oauth_authorizations` (`app_id`, `app_public_key`);
