DELETE FROM login_requests;
ALTER TABLE login_requests ADD COLUMN identity_id TEXT NOT NULL REFERENCES identities(id) ON DELETE CASCADE;
DROP INDEX login_requests_handle_idx;
ALTER TABLE login_requests DROP COLUMN handle;
CREATE INDEX login_requests_identity_id_idx ON login_requests(identity_id);
