ALTER TABLE oauth_authorizations ADD COLUMN scope TEXT NOT NULL DEFAULT '';

ALTER TABLE oauth_authorization_codes ADD COLUMN authorization_id TEXT REFERENCES oauth_authorizations(id) ON DELETE CASCADE;
ALTER TABLE oauth_access_tokens ADD COLUMN authorization_id TEXT REFERENCES oauth_authorizations(id) ON DELETE CASCADE;
ALTER TABLE oauth_refresh_tokens ADD COLUMN authorization_id TEXT REFERENCES oauth_authorizations(id) ON DELETE CASCADE;
ALTER TABLE oauth_delegation_grants ADD COLUMN authorization_id TEXT REFERENCES oauth_authorizations(id) ON DELETE CASCADE;

UPDATE oauth_authorization_codes
SET authorization_id = (
  SELECT id FROM oauth_authorizations
  WHERE user_id = json_extract(oauth_authorization_codes.value, '$.userId')
    AND app_id = json_extract(oauth_authorization_codes.value, '$.appId')
    AND identity_id = json_extract(oauth_authorization_codes.value, '$.identityId')
);
UPDATE oauth_access_tokens
SET authorization_id = (
  SELECT id FROM oauth_authorizations
  WHERE user_id = json_extract(oauth_access_tokens.value, '$.userId')
    AND app_id = json_extract(oauth_access_tokens.value, '$.appId')
    AND identity_id = json_extract(oauth_access_tokens.value, '$.identityId')
);
UPDATE oauth_refresh_tokens
SET authorization_id = (
  SELECT id FROM oauth_authorizations
  WHERE user_id = oauth_refresh_tokens.user_id
    AND app_id = oauth_refresh_tokens.app_id
    AND identity_id = oauth_refresh_tokens.identity_id
    AND created_at <= oauth_refresh_tokens.created_at
);
UPDATE oauth_delegation_grants
SET authorization_id = (
  SELECT id FROM oauth_authorizations
  WHERE user_id = oauth_delegation_grants.user_id
    AND app_id = oauth_delegation_grants.source_app_id
    AND identity_id = oauth_delegation_grants.identity_id
    AND created_at <= oauth_delegation_grants.created_at
);

DELETE FROM oauth_authorization_codes
WHERE authorization_id IS NULL AND json_extract(value, '$.appId') NOT LIKE 'origin:%';
DELETE FROM oauth_access_tokens
WHERE authorization_id IS NULL AND json_extract(value, '$.appId') NOT LIKE 'origin:%';
DELETE FROM oauth_refresh_tokens WHERE authorization_id IS NULL;
DELETE FROM oauth_delegation_grants WHERE authorization_id IS NULL;

CREATE INDEX oauth_authorization_codes_authorization_id_idx ON oauth_authorization_codes(authorization_id);
CREATE INDEX oauth_access_tokens_authorization_id_idx ON oauth_access_tokens(authorization_id);
CREATE INDEX oauth_refresh_tokens_authorization_id_idx ON oauth_refresh_tokens(authorization_id);
CREATE INDEX oauth_delegation_grants_authorization_id_idx ON oauth_delegation_grants(authorization_id);
