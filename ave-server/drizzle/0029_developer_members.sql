CREATE TABLE `developer_members` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`organization_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`identity_id`) REFERENCES `identities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `developer_members_org_identity_unique` ON `developer_members` (`organization_id`,`identity_id`);--> statement-breakpoint
CREATE INDEX `developer_members_identity_status_idx` ON `developer_members` (`identity_id`,`status`);--> statement-breakpoint
INSERT INTO developer_members (id, created_at, updated_at, organization_id, identity_id, role, status)
SELECT id, created_at, updated_at, organization_id, identity_id,
  CASE WHEN role = 'owner' THEN 'owner'
       WHEN role = 'admin' AND signing_authority = 1 THEN 'admin'
       ELSE 'viewer' END,
  CASE WHEN status = 'active' THEN 'active' ELSE 'inactive' END
FROM organization_identity_members;
