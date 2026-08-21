-- Tenant-managed GTFS-Realtime Alerts. Rows are tied to the promoted Schedule version.
CREATE TABLE gtfs_realtime_alerts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  feed_version_id text NOT NULL,
  header_text text NOT NULL CHECK (length(header_text) BETWEEN 1 AND 240),
  description_text text CHECK (description_text IS NULL OR length(description_text) <= 2000),
  active_from timestamptz,
  active_until timestamptz,
  route_public_ids text[] NOT NULL DEFAULT '{}',
  stop_public_ids text[] NOT NULL DEFAULT '{}',
  trip_public_ids text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'withdrawn')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (active_until IS NULL OR active_from IS NULL OR active_until > active_from)
);
CREATE INDEX gtfs_realtime_alerts_public_idx ON gtfs_realtime_alerts (tenant_id, feed_version_id, status, active_from);
ALTER TABLE gtfs_realtime_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY gtfs_realtime_alerts_tenant_isolation ON gtfs_realtime_alerts
  USING (tenant_id = current_setting('booking.tenant_id', true) OR current_setting('booking.public_feed', true) = 'true');
