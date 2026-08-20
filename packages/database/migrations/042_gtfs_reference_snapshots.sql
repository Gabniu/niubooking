-- Immutable per-version Schedule references used to validate public realtime output.
CREATE TABLE gtfs_feed_version_entities (
  tenant_id text NOT NULL,
  feed_version_id text NOT NULL,
  entity_kind text NOT NULL CHECK (entity_kind IN ('route', 'trip', 'stop')),
  public_id text NOT NULL CHECK (public_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, feed_version_id, entity_kind, public_id),
  FOREIGN KEY (tenant_id, feed_version_id) REFERENCES gtfs_feed_versions (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX gtfs_feed_version_entities_lookup_idx
  ON gtfs_feed_version_entities (tenant_id, feed_version_id, entity_kind, public_id);
ALTER TABLE gtfs_feed_version_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE gtfs_feed_version_entities FORCE ROW LEVEL SECURITY;
CREATE POLICY gtfs_feed_version_entities_tenant_isolation ON gtfs_feed_version_entities
  USING (tenant_id = current_setting('booking.tenant_id', true));
