CREATE TABLE `identity_encryption_keys` (
  `id` text PRIMARY KEY NOT NULL,
  `identity_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `public_key` text NOT NULL,
  `encrypted_private_key` text NOT NULL,
  FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `identity_encryption_keys_identity_id_unique` ON `identity_encryption_keys` (`identity_id`);
CREATE INDEX `identity_encryption_keys_identity_id_idx` ON `identity_encryption_keys` (`identity_id`);

INSERT OR IGNORE INTO `identity_encryption_keys` (`id`, `identity_id`, `created_at`, `updated_at`, `public_key`, `encrypted_private_key`)
SELECT `id`, `identity_id`, `created_at`, `created_at`, `public_key`, `encrypted_private_key`
FROM `signing_keys`;
