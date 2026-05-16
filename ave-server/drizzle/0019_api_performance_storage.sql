CREATE TABLE `ephemeral_challenges` (
  `id` text PRIMARY KEY NOT NULL,
  `namespace` text NOT NULL,
  `challenge_key` text NOT NULL,
  `value` text NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ephemeral_challenges_namespace_key_unique` ON `ephemeral_challenges` (`namespace`,`challenge_key`);
--> statement-breakpoint
CREATE INDEX `ephemeral_challenges_expires_at_idx` ON `ephemeral_challenges` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `oauth_authorization_codes` (
  `id` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oauth_authorization_codes_expires_at_idx` ON `oauth_authorization_codes` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `oauth_access_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oauth_access_tokens_expires_at_idx` ON `oauth_access_tokens` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `organization_identity_members_org_status_identity_idx` ON `organization_identity_members` (`organization_id`,`status`,`identity_id`);
--> statement-breakpoint
CREATE INDEX `organization_identity_members_identity_status_idx` ON `organization_identity_members` (`identity_id`,`status`);
--> statement-breakpoint
CREATE INDEX `activity_logs_user_created_at_idx` ON `activity_logs` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `app_analytics_events_app_created_at_idx` ON `app_analytics_events` (`app_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_rotated_from_id_idx` ON `oauth_refresh_tokens` (`rotated_from_id`);
--> statement-breakpoint
CREATE INDEX `oauth_authorizations_user_app_idx` ON `oauth_authorizations` (`user_id`,`app_id`);
--> statement-breakpoint
CREATE INDEX `oauth_authorizations_user_app_identity_idx` ON `oauth_authorizations` (`user_id`,`app_id`,`identity_id`);
--> statement-breakpoint
CREATE INDEX `oauth_delegation_grants_active_lookup_idx` ON `oauth_delegation_grants` (`user_id`,`identity_id`,`source_app_id`,`target_resource_id`,`revoked_at`);
--> statement-breakpoint
CREATE INDEX `organization_keyrings_org_status_idx` ON `organization_keyrings` (`organization_id`,`status`);
--> statement-breakpoint
CREATE INDEX `organization_key_grants_org_status_identity_idx` ON `organization_key_grants` (`organization_id`,`status`,`identity_id`);
--> statement-breakpoint
CREATE INDEX `organization_sso_connections_org_status_idx` ON `organization_sso_connections` (`organization_id`,`status`);
--> statement-breakpoint
CREATE INDEX `organization_domain_verifications_org_status_idx` ON `organization_domain_verifications` (`organization_id`,`status`);
--> statement-breakpoint
CREATE INDEX `organization_audit_events_org_created_at_idx` ON `organization_audit_events` (`organization_id`,`created_at`);
