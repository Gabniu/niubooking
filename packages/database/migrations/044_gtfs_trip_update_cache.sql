-- Short-lived public GTFS-Realtime TripUpdates cache populated by the bounded worker.
CREATE TABLE gtfs_realtime_trip_update_cache (
  tenant_id text NOT NULL,
  public_slug text NOT NULL,
  schedule_version text NOT NULL,
  payload bytea NOT NULL CHECK (octet_length(payload) BETWEEN 1 AND 10485760),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  generated_at timestamptz NOT NULL,
  entity_count integer NOT NULL CHECK (entity_count >= 0 AND entity_count <= 100000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, public_slug)
);
CREATE INDEX gtfs_realtime_trip_update_cache_fresh_idx ON gtfs_realtime_trip_update_cache (public_slug, generated_at DESC);
ALTER TABLE gtfs_realtime_trip_update_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY gtfs_realtime_trip_update_cache_tenant_isolation ON gtfs_realtime_trip_update_cache
  USING (tenant_id = current_setting('booking.tenant_id', true) OR current_setting('booking.public_feed', true) = 'true');
