DROP TABLE oauth_delegation_audit_logs;
--> statement-breakpoint
DROP TABLE oauth_delegation_grants;
--> statement-breakpoint
DROP TABLE oauth_resources;
--> statement-breakpoint
DROP TABLE signature_requests;
--> statement-breakpoint
DROP TABLE signing_keys;
--> statement-breakpoint
DROP TABLE app_analytics_events;
--> statement-breakpoint
DROP TABLE organization_members;
--> statement-breakpoint
CREATE TABLE app_team_links AS SELECT id AS app_id, organization_id FROM oauth_apps;
--> statement-breakpoint
UPDATE oauth_apps SET organization_id = NULL, owner_id = NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS oauth_apps_owner_id_idx;
--> statement-breakpoint
CREATE TABLE developer_members_copy AS SELECT id, created_at, updated_at, organization_id, identity_id FROM developer_members WHERE status = 'active';
--> statement-breakpoint
DROP TABLE developer_members;
--> statement-breakpoint
CREATE TABLE organizations_next (
	id text PRIMARY KEY NOT NULL,
	created_at integer NOT NULL,
	updated_at integer NOT NULL,
	name text NOT NULL,
	logo_url text,
	slug text NOT NULL
);
--> statement-breakpoint
INSERT INTO organizations_next (id, created_at, updated_at, name, logo_url, slug)
SELECT id, created_at, updated_at, name, logo_url, slug FROM organizations;
--> statement-breakpoint
DROP TABLE organizations;
--> statement-breakpoint
ALTER TABLE organizations_next RENAME TO organizations;
--> statement-breakpoint
CREATE UNIQUE INDEX organizations_slug_unique ON organizations (slug);
--> statement-breakpoint
CREATE INDEX organizations_slug_idx ON organizations (slug);
--> statement-breakpoint
CREATE TABLE developer_members (
	id text PRIMARY KEY NOT NULL,
	created_at integer NOT NULL,
	updated_at integer NOT NULL,
	organization_id text NOT NULL,
	identity_id text NOT NULL,
	FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (identity_id) REFERENCES identities(id) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO developer_members (id, created_at, updated_at, organization_id, identity_id)
SELECT id, created_at, updated_at, organization_id, identity_id FROM developer_members_copy;
--> statement-breakpoint
DROP TABLE developer_members_copy;
--> statement-breakpoint
CREATE UNIQUE INDEX developer_members_org_identity_unique ON developer_members (organization_id, identity_id);
--> statement-breakpoint
CREATE INDEX developer_members_identity_id_idx ON developer_members (identity_id);
--> statement-breakpoint
UPDATE oauth_apps SET organization_id = (SELECT organization_id FROM app_team_links WHERE app_team_links.app_id = oauth_apps.id);
--> statement-breakpoint
DROP TABLE app_team_links;
--> statement-breakpoint
ALTER TABLE identities DROP COLUMN banner_url;
