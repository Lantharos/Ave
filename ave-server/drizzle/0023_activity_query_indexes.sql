CREATE INDEX `devices_user_fingerprint_idx` ON `devices` (`user_id`,`fingerprint`);
--> statement-breakpoint
CREATE INDEX `oauth_delegation_audit_logs_source_app_created_at_idx` ON `oauth_delegation_audit_logs` (`source_app_id`,`created_at`);
