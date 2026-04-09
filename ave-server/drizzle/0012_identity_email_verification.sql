ALTER TABLE `identities` ADD `pending_email` text;
ALTER TABLE `identities` ADD `email_verification_code_hash` text;
ALTER TABLE `identities` ADD `email_verification_expires_at` integer;
ALTER TABLE `identities` ADD `email_verification_sent_at` integer;
