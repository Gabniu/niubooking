-- Idempotent, audited Schedule lifecycle commands.
CREATE TABLE gtfs_publication_commands (
  tenant_id text NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  action text NOT NULL CHECK (action IN ('validate', 'publish', 'withdraw', 'rollback')),
  feed_version_id text NOT NULL,
  result_version_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, feed_version_id) REFERENCES gtfs_feed_versions (tenant_id, id),
  FOREIGN KEY (tenant_id, result_version_id) REFERENCES gtfs_feed_versions (tenant_id, id)
);
ALTER TABLE gtfs_publication_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY gtfs_publication_commands_tenant_isolation ON gtfs_publication_commands
  USING (tenant_id = current_setting('booking.tenant_id', true));
