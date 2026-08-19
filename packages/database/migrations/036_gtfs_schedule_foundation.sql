-- Stable transit schedule data and immutable GTFS publication versions.
ALTER TABLE audit_events DROP CONSTRAINT audit_events_entity_type_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_entity_type_check
  CHECK (entity_type IN ('reservation', 'gtfs_feed_version'));

CREATE TABLE transport_agencies (
  tenant_id text NOT NULL,
  id text NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  url text NOT NULL,
  timezone text NOT NULL,
  language text,
  phone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE transport_stops (
  tenant_id text NOT NULL,
  id text NOT NULL,
  code text,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  description text,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  location_type smallint NOT NULL DEFAULT 0 CHECK (location_type BETWEEN 0 AND 4),
  parent_stop_id text,
  platform_code text,
  wheelchair_boarding text NOT NULL DEFAULT 'unknown'
    CHECK (wheelchair_boarding IN ('unknown', 'possible', 'not_possible')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, parent_stop_id) REFERENCES transport_stops (tenant_id, id)
);
CREATE INDEX transport_stops_tenant_location_idx ON transport_stops (tenant_id, latitude, longitude);

CREATE TABLE transport_service_calendars (
  tenant_id text NOT NULL,
  id text NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  monday boolean NOT NULL,
  tuesday boolean NOT NULL,
  wednesday boolean NOT NULL,
  thursday boolean NOT NULL,
  friday boolean NOT NULL,
  saturday boolean NOT NULL,
  sunday boolean NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  CHECK (end_date >= start_date)
);

CREATE TABLE transport_service_exceptions (
  tenant_id text NOT NULL,
  service_id text NOT NULL,
  service_date date NOT NULL,
  exception_type text NOT NULL CHECK (exception_type IN ('added', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, service_id, service_date),
  FOREIGN KEY (tenant_id, service_id) REFERENCES transport_service_calendars (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE transport_shapes (
  tenant_id text NOT NULL,
  id text NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE transport_shape_points (
  tenant_id text NOT NULL,
  shape_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 0),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  distance double precision CHECK (distance IS NULL OR distance >= 0),
  PRIMARY KEY (tenant_id, shape_id, sequence),
  FOREIGN KEY (tenant_id, shape_id) REFERENCES transport_shapes (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE transport_trip_patterns (
  tenant_id text NOT NULL,
  id text NOT NULL,
  route_id text NOT NULL,
  route_version integer NOT NULL,
  service_id text NOT NULL,
  shape_id text,
  headsign text,
  direction_id smallint CHECK (direction_id IS NULL OR direction_id IN (0, 1)),
  block_id text,
  wheelchair_accessible text NOT NULL DEFAULT 'unknown'
    CHECK (wheelchair_accessible IN ('unknown', 'possible', 'not_possible')),
  bikes_allowed text NOT NULL DEFAULT 'unknown'
    CHECK (bikes_allowed IN ('unknown', 'allowed', 'not_allowed')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, route_id, route_version) REFERENCES transport_routes (tenant_id, id, version),
  FOREIGN KEY (tenant_id, service_id) REFERENCES transport_service_calendars (tenant_id, id),
  FOREIGN KEY (tenant_id, shape_id) REFERENCES transport_shapes (tenant_id, id)
);

CREATE TABLE transport_pattern_stop_times (
  tenant_id text NOT NULL,
  pattern_id text NOT NULL,
  stop_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 0),
  arrival_seconds integer NOT NULL CHECK (arrival_seconds BETWEEN 0 AND 172799),
  departure_seconds integer NOT NULL CHECK (departure_seconds BETWEEN 0 AND 172799),
  pickup_type smallint NOT NULL DEFAULT 0 CHECK (pickup_type BETWEEN 0 AND 3),
  drop_off_type smallint NOT NULL DEFAULT 0 CHECK (drop_off_type BETWEEN 0 AND 3),
  shape_distance double precision CHECK (shape_distance IS NULL OR shape_distance >= 0),
  pickup_window_start_seconds integer CHECK (pickup_window_start_seconds BETWEEN 0 AND 172799),
  pickup_window_end_seconds integer CHECK (pickup_window_end_seconds BETWEEN 0 AND 172799),
  booking_rule_id text,
  PRIMARY KEY (tenant_id, pattern_id, sequence),
  FOREIGN KEY (tenant_id, pattern_id) REFERENCES transport_trip_patterns (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, stop_id) REFERENCES transport_stops (tenant_id, id),
  CHECK (departure_seconds >= arrival_seconds),
  CHECK (pickup_window_end_seconds IS NULL OR pickup_window_start_seconds IS NOT NULL),
  CHECK (pickup_window_end_seconds IS NULL OR pickup_window_end_seconds > pickup_window_start_seconds)
);

CREATE TABLE transport_frequency_windows (
  tenant_id text NOT NULL,
  pattern_id text NOT NULL,
  start_seconds integer NOT NULL CHECK (start_seconds BETWEEN 0 AND 172799),
  end_seconds integer NOT NULL CHECK (end_seconds BETWEEN 1 AND 172799),
  headway_seconds integer NOT NULL CHECK (headway_seconds > 0),
  exact_times boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, pattern_id, start_seconds),
  FOREIGN KEY (tenant_id, pattern_id) REFERENCES transport_trip_patterns (tenant_id, id) ON DELETE CASCADE,
  CHECK (end_seconds > start_seconds)
);

CREATE TABLE gtfs_public_id_mappings (
  tenant_id text NOT NULL,
  entity_kind text NOT NULL CHECK (entity_kind IN ('agency', 'stop', 'route', 'service', 'trip', 'shape', 'vehicle', 'fare', 'area', 'pathway')),
  internal_id text NOT NULL,
  public_id text NOT NULL CHECK (public_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  PRIMARY KEY (tenant_id, entity_kind, internal_id),
  UNIQUE (tenant_id, entity_kind, public_id)
);

CREATE TABLE gtfs_feed_settings (
  tenant_id text PRIMARY KEY,
  public_slug text NOT NULL CHECK (public_slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  publisher_name text NOT NULL,
  publisher_url text NOT NULL,
  default_language text NOT NULL,
  enabled_features text[] NOT NULL DEFAULT '{core}',
  schedule_publication_enabled boolean NOT NULL DEFAULT false,
  realtime_publication_enabled boolean NOT NULL DEFAULT false,
  active_version_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (public_slug)
);

CREATE TABLE gtfs_feed_versions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'validating', 'ready', 'published', 'failed', 'withdrawn')),
  valid_from date NOT NULL,
  valid_until date NOT NULL,
  schedule_sha256 text,
  schedule_object_key text,
  generated_at timestamptz,
  validated_at timestamptz,
  published_at timestamptz,
  withdrawn_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, version),
  UNIQUE (tenant_id, id),
  CHECK (valid_until >= valid_from),
  CHECK (schedule_sha256 IS NULL OR schedule_sha256 ~ '^[0-9a-f]{64}$')
);
ALTER TABLE gtfs_feed_settings
  ADD CONSTRAINT gtfs_feed_settings_active_version_fk
  FOREIGN KEY (tenant_id, active_version_id) REFERENCES gtfs_feed_versions (tenant_id, id);

CREATE TABLE gtfs_validation_issues (
  tenant_id text NOT NULL,
  feed_version_id text NOT NULL,
  issue_index integer NOT NULL CHECK (issue_index >= 0),
  code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
  file_name text,
  entity_public_id text,
  message text NOT NULL,
  suggested_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, feed_version_id, issue_index),
  FOREIGN KEY (tenant_id, feed_version_id) REFERENCES gtfs_feed_versions (tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX transport_trip_patterns_tenant_route_idx ON transport_trip_patterns (tenant_id, route_id, route_version, status);
CREATE INDEX gtfs_feed_versions_tenant_status_idx ON gtfs_feed_versions (tenant_id, status, created_at DESC);
CREATE INDEX gtfs_validation_issues_version_idx ON gtfs_validation_issues (tenant_id, feed_version_id, severity);

ALTER TABLE transport_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_service_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_service_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_shape_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_trip_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_pattern_stop_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_frequency_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE gtfs_public_id_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gtfs_feed_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gtfs_feed_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gtfs_validation_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY transport_agencies_tenant_isolation ON transport_agencies USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY transport_stops_tenant_isolation ON transport_stops USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY transport_service_calendars_tenant_isolation ON transport_service_calendars USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY transport_service_exceptions_tenant_isolation ON transport_service_exceptions USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY transport_shapes_tenant_isolation ON transport_shapes USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY transport_shape_points_tenant_isolation ON transport_shape_points USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY transport_trip_patterns_tenant_isolation ON transport_trip_patterns USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY transport_pattern_stop_times_tenant_isolation ON transport_pattern_stop_times USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY transport_frequency_windows_tenant_isolation ON transport_frequency_windows USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY gtfs_public_id_mappings_tenant_isolation ON gtfs_public_id_mappings USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY gtfs_feed_settings_tenant_isolation ON gtfs_feed_settings USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY gtfs_feed_versions_tenant_isolation ON gtfs_feed_versions USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY gtfs_validation_issues_tenant_isolation ON gtfs_validation_issues USING (tenant_id = current_setting('booking.tenant_id', true));
