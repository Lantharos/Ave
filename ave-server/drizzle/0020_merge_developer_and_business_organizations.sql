DROP TABLE IF EXISTS __ave_organization_membership_migration_map;
--> statement-breakpoint
DROP TABLE IF EXISTS __ave_organization_merge_map;
--> statement-breakpoint
CREATE TABLE __ave_organization_merge_map (
  source_id text PRIMARY KEY NOT NULL,
  target_id text NOT NULL
);
--> statement-breakpoint
INSERT INTO __ave_organization_merge_map (source_id, target_id)
SELECT
  source.id AS source_id,
  (
    SELECT target.id
    FROM organizations target
    WHERE target.plan = 'business'
      AND target.id <> source.id
      AND target.owner_user_id = source.owner_user_id
      AND lower(trim(target.name)) = lower(trim(source.name))
    ORDER BY target.created_at ASC, target.id ASC
    LIMIT 1
  ) AS target_id
FROM organizations source
WHERE source.plan <> 'business'
  AND EXISTS (
    SELECT 1
    FROM organizations target
    WHERE target.plan = 'business'
      AND target.id <> source.id
      AND target.owner_user_id = source.owner_user_id
      AND lower(trim(target.name)) = lower(trim(source.name))
  );
--> statement-breakpoint
CREATE TABLE __ave_organization_membership_migration_map (
  source_member_id text PRIMARY KEY NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  user_id text NOT NULL,
  invited_by_user_id text,
  role text NOT NULL,
  status text NOT NULL,
  source_organization_id text NOT NULL,
  target_organization_id text NOT NULL
);
--> statement-breakpoint
INSERT INTO __ave_organization_membership_migration_map (
  source_member_id,
  created_at,
  updated_at,
  user_id,
  invited_by_user_id,
  role,
  status,
  source_organization_id,
  target_organization_id
)
SELECT
  organization_members.id AS source_member_id,
  organization_members.created_at,
  organization_members.updated_at,
  organization_members.user_id,
  organization_members.invited_by_user_id,
  organization_members.role,
  organization_members.status,
  organization_members.organization_id AS source_organization_id,
  coalesce(__ave_organization_merge_map.target_id, organization_members.organization_id) AS target_organization_id
FROM organization_members
LEFT JOIN __ave_organization_merge_map ON __ave_organization_merge_map.source_id = organization_members.organization_id
WHERE organization_members.user_id IS NOT NULL
  AND organization_members.status = 'active'
  AND EXISTS (
    SELECT 1
    FROM identities
    WHERE identities.user_id = organization_members.user_id
  );
--> statement-breakpoint
INSERT INTO organization_identity_members (
  id,
  created_at,
  updated_at,
  organization_id,
  identity_id,
  added_by_user_id,
  added_by_identity_id,
  role,
  scopes,
  signing_authority,
  status
)
SELECT
  'dev_' || source_member_id,
  created_at,
  updated_at,
  target_organization_id,
  (
    SELECT identities.id
    FROM identities
    WHERE identities.user_id = __ave_organization_membership_migration_map.user_id
    ORDER BY identities.is_primary DESC, identities.created_at ASC, identities.id ASC
    LIMIT 1
  ),
  invited_by_user_id,
  (
    SELECT identities.id
    FROM identities
    WHERE identities.user_id = __ave_organization_membership_migration_map.invited_by_user_id
    ORDER BY identities.is_primary DESC, identities.created_at ASC, identities.id ASC
    LIMIT 1
  ),
  CASE role
    WHEN 'owner' THEN 'owner'
    WHEN 'admin' THEN 'admin'
    ELSE 'viewer'
  END,
  CASE role
    WHEN 'owner' THEN '["read","sign","approve","manage_identities","manage_keys","manage_sso","manage_org"]'
    WHEN 'admin' THEN '["read","sign","approve","manage_identities","manage_keys","manage_sso"]'
    ELSE '["read"]'
  END,
  CASE role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 1
    ELSE 0
  END,
  'active'
FROM __ave_organization_membership_migration_map
WHERE (
  SELECT identities.id
  FROM identities
  WHERE identities.user_id = __ave_organization_membership_migration_map.user_id
  ORDER BY identities.is_primary DESC, identities.created_at ASC, identities.id ASC
  LIMIT 1
) IS NOT NULL
ON CONFLICT(organization_id, identity_id) DO UPDATE SET
  role = CASE
    WHEN organization_identity_members.role = 'owner' OR excluded.role = 'owner' THEN 'owner'
    WHEN organization_identity_members.role = 'admin' OR excluded.role = 'admin' THEN 'admin'
    ELSE organization_identity_members.role
  END,
  scopes = CASE
    WHEN organization_identity_members.role = 'owner' OR excluded.role = 'owner' THEN '["read","sign","approve","manage_identities","manage_keys","manage_sso","manage_org"]'
    WHEN organization_identity_members.role = 'admin' OR excluded.role = 'admin' THEN '["read","sign","approve","manage_identities","manage_keys","manage_sso"]'
    ELSE organization_identity_members.scopes
  END,
  signing_authority = CASE
    WHEN organization_identity_members.signing_authority = 1 OR excluded.signing_authority = 1 THEN 1
    ELSE 0
  END,
  status = 'active',
  updated_at = CASE
    WHEN excluded.updated_at > organization_identity_members.updated_at THEN excluded.updated_at
    ELSE organization_identity_members.updated_at
  END;
--> statement-breakpoint
UPDATE organizations
SET
  logo_url = coalesce(
    logo_url,
    (
      SELECT source.logo_url
      FROM organizations source
      INNER JOIN __ave_organization_merge_map ON __ave_organization_merge_map.source_id = source.id
      WHERE __ave_organization_merge_map.target_id = organizations.id
        AND source.logo_url IS NOT NULL
      ORDER BY source.updated_at DESC
      LIMIT 1
    )
  ),
  app_limit = max(
    app_limit,
    coalesce(
      (
        SELECT max(source.app_limit)
        FROM organizations source
        INNER JOIN __ave_organization_merge_map ON __ave_organization_merge_map.source_id = source.id
        WHERE __ave_organization_merge_map.target_id = organizations.id
      ),
      app_limit
    )
  ),
  updated_at = cast(strftime('%s', 'now') AS integer) * 1000
WHERE id IN (
  SELECT target_id
  FROM __ave_organization_merge_map
);
--> statement-breakpoint
UPDATE oauth_apps
SET organization_id = (
  SELECT target_id
  FROM __ave_organization_merge_map
  WHERE __ave_organization_merge_map.source_id = oauth_apps.organization_id
)
WHERE organization_id IN (
  SELECT source_id
  FROM __ave_organization_merge_map
);
--> statement-breakpoint
DELETE FROM organization_members
WHERE organization_id IN (
  SELECT source_id
  FROM __ave_organization_merge_map
);
--> statement-breakpoint
DELETE FROM organizations
WHERE id IN (
  SELECT source_id
  FROM __ave_organization_merge_map
);
--> statement-breakpoint
UPDATE organizations
SET
  plan = 'business',
  updated_at = cast(strftime('%s', 'now') AS integer) * 1000
WHERE plan <> 'business';
--> statement-breakpoint
DROP TABLE __ave_organization_membership_migration_map;
--> statement-breakpoint
DROP TABLE __ave_organization_merge_map;
