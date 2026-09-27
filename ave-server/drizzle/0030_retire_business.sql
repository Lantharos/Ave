DELETE FROM sessions WHERE auth_method = 'enterprise_sso';
--> statement-breakpoint
DELETE FROM oauth_refresh_tokens WHERE organization_id IS NOT NULL OR enterprise_sso_organization_id IS NOT NULL;
--> statement-breakpoint
DELETE FROM oauth_access_tokens WHERE json_extract(value, '$.organizationId') IS NOT NULL;
--> statement-breakpoint
DELETE FROM oauth_authorization_codes WHERE json_extract(value, '$.organizationId') IS NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS sessions_enterprise_sso_organization_id_idx;
--> statement-breakpoint
DROP INDEX IF EXISTS oauth_refresh_tokens_organization_id_idx;
--> statement-breakpoint
DROP INDEX IF EXISTS oauth_refresh_tokens_organization_member_id_idx;
--> statement-breakpoint
DROP INDEX IF EXISTS oauth_refresh_tokens_enterprise_sso_organization_id_idx;
--> statement-breakpoint
ALTER TABLE sessions DROP COLUMN enterprise_sso_organization_id;
--> statement-breakpoint
ALTER TABLE sessions DROP COLUMN enterprise_sso_connection_id;
--> statement-breakpoint
ALTER TABLE oauth_refresh_tokens DROP COLUMN organization_id;
--> statement-breakpoint
ALTER TABLE oauth_refresh_tokens DROP COLUMN organization_member_id;
--> statement-breakpoint
ALTER TABLE oauth_refresh_tokens DROP COLUMN enterprise_sso_organization_id;
--> statement-breakpoint
ALTER TABLE oauth_refresh_tokens DROP COLUMN enterprise_sso_connection_id;
--> statement-breakpoint
ALTER TABLE organizations DROP COLUMN plan;
--> statement-breakpoint
ALTER TABLE organizations DROP COLUMN verified_domains;
--> statement-breakpoint
ALTER TABLE organizations DROP COLUMN sso_required;
--> statement-breakpoint
DROP TABLE organization_key_grants;
--> statement-breakpoint
DROP TABLE organization_keyrings;
--> statement-breakpoint
DROP TABLE organization_sso_connections;
--> statement-breakpoint
DROP TABLE organization_domain_verifications;
--> statement-breakpoint
DROP TABLE organization_encryption_policies;
--> statement-breakpoint
DROP TABLE organization_audit_events;
--> statement-breakpoint
DROP TABLE organization_identity_members;
