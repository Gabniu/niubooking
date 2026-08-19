-- Branch-scoped, replay-safe fleet tracking persistence. Raw device secrets are never stored.
ALTER TABLE audit_events DROP CONSTRAINT audit_events_entity_type_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_entity_type_check
  CHECK (entity_type IN (
    'reservation', 'gtfs_feed_version', 'fleet_device',
    'transport_trip_assignment', 'fleet_tracking_session'
  ));

CREATE TABLE tenant_branches (
  tenant_id text NOT NULL,
  id text NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  timezone text NOT NULL CHECK (length(trim(timezone)) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
INSERT INTO tenant_branches (tenant_id, id, name, timezone)
SELECT DISTINCT membership.tenant_id, branch.id, branch.id, 'UTC'
FROM tenant_memberships membership
CROSS JOIN LATERAL unnest(membership.branch_ids) AS branch(id)
WHERE branch.id <> ''
ON CONFLICT (tenant_id, id) DO NOTHING;

ALTER TABLE transport_trips ADD COLUMN branch_id text;
ALTER TABLE transport_trips
  ADD CONSTRAINT transport_trips_branch_fk
  FOREIGN KEY (tenant_id, branch_id) REFERENCES tenant_branches (tenant_id, id);
ALTER TABLE transport_trips
  ADD CONSTRAINT transport_trips_tenant_id_branch_unique UNIQUE (tenant_id, id, branch_id);
CREATE INDEX transport_trips_tenant_branch_boarding_idx
  ON transport_trips (tenant_id, branch_id, boarding_starts_at, boarding_ends_at);

CREATE TABLE transport_trip_assignments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  branch_id text NOT NULL,
  trip_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('driver', 'conductor')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_by text,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES tenant_branches (tenant_id, id),
  FOREIGN KEY (tenant_id, trip_id, branch_id)
    REFERENCES transport_trips (tenant_id, id, branch_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships (tenant_id, user_id),
  CHECK ((status = 'active' AND ended_at IS NULL) OR (status = 'ended' AND ended_at IS NOT NULL))
);
CREATE UNIQUE INDEX transport_trip_active_driver_idx
  ON transport_trip_assignments (tenant_id, trip_id)
  WHERE status = 'active' AND role = 'driver';
CREATE INDEX transport_trip_assignments_user_idx
  ON transport_trip_assignments (tenant_id, user_id, status, trip_id);

CREATE TABLE fleet_devices (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  branch_id text NOT NULL,
  user_id text,
  vehicle_resource_id text,
  credential_hash text NOT NULL UNIQUE CHECK (credential_hash ~ '^[0-9a-f]{64}$'),
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'hardware')),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'revoked')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  enrolled_by text,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, branch_id),
  FOREIGN KEY (tenant_id, branch_id) REFERENCES tenant_branches (tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships (tenant_id, user_id),
  FOREIGN KEY (tenant_id, vehicle_resource_id) REFERENCES booking_resources (tenant_id, id),
  CHECK (user_id IS NOT NULL OR vehicle_resource_id IS NOT NULL),
  CHECK ((status = 'enrolled' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL))
);
CREATE INDEX fleet_devices_tenant_branch_status_idx
  ON fleet_devices (tenant_id, branch_id, status, id);

CREATE TABLE fleet_tracking_sessions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  branch_id text NOT NULL,
  trip_id text NOT NULL,
  device_id text NOT NULL,
  driver_user_id text NOT NULL,
  vehicle_resource_id text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'revoked')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  started_by text,
  ended_by text,
  end_reason text,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, branch_id, trip_id, device_id, vehicle_resource_id),
  FOREIGN KEY (tenant_id, trip_id, branch_id)
    REFERENCES transport_trips (tenant_id, id, branch_id),
  FOREIGN KEY (tenant_id, device_id, branch_id)
    REFERENCES fleet_devices (tenant_id, id, branch_id),
  FOREIGN KEY (tenant_id, driver_user_id) REFERENCES tenant_memberships (tenant_id, user_id),
  FOREIGN KEY (tenant_id, vehicle_resource_id) REFERENCES booking_resources (tenant_id, id),
  CHECK (expires_at > started_at),
  CHECK ((status = 'active' AND ended_at IS NULL) OR (status <> 'active' AND ended_at IS NOT NULL))
);
CREATE UNIQUE INDEX fleet_active_session_trip_idx
  ON fleet_tracking_sessions (tenant_id, trip_id) WHERE status = 'active';
CREATE UNIQUE INDEX fleet_active_session_vehicle_idx
  ON fleet_tracking_sessions (tenant_id, vehicle_resource_id) WHERE status = 'active';
CREATE UNIQUE INDEX fleet_active_session_device_idx
  ON fleet_tracking_sessions (tenant_id, device_id) WHERE status = 'active';

CREATE TABLE fleet_telemetry_receipts (
  tenant_id text NOT NULL,
  event_id text NOT NULL,
  session_id text NOT NULL,
  device_id text NOT NULL,
  sequence bigint NOT NULL CHECK (sequence >= 0),
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  decision text NOT NULL CHECK (decision IN ('advance_current', 'history_only', 'reject')),
  reason_code text,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (tenant_id, event_id),
  FOREIGN KEY (tenant_id, session_id) REFERENCES fleet_tracking_sessions (tenant_id, id),
  FOREIGN KEY (tenant_id, device_id) REFERENCES fleet_devices (tenant_id, id)
);
CREATE INDEX fleet_receipts_session_time_idx
  ON fleet_telemetry_receipts (tenant_id, session_id, captured_at DESC);

CREATE TABLE fleet_position_history (
  tenant_id text NOT NULL,
  branch_id text NOT NULL,
  trip_id text NOT NULL,
  session_id text NOT NULL,
  device_id text NOT NULL,
  vehicle_resource_id text NOT NULL,
  event_id text NOT NULL,
  sequence bigint NOT NULL CHECK (sequence >= 0),
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_metres double precision NOT NULL CHECK (accuracy_metres BETWEEN 0 AND 250),
  speed_metres_per_second double precision CHECK (speed_metres_per_second BETWEEN 0 AND 70),
  heading_degrees double precision CHECK (heading_degrees >= 0 AND heading_degrees < 360),
  battery_percent double precision CHECK (battery_percent BETWEEN 0 AND 100),
  disposition text NOT NULL CHECK (disposition IN ('advance_current', 'history_only')),
  PRIMARY KEY (tenant_id, captured_at, event_id),
  FOREIGN KEY (tenant_id, event_id) REFERENCES fleet_telemetry_receipts (tenant_id, event_id),
  FOREIGN KEY (tenant_id, session_id, branch_id, trip_id, device_id, vehicle_resource_id)
    REFERENCES fleet_tracking_sessions (tenant_id, id, branch_id, trip_id, device_id, vehicle_resource_id)
) PARTITION BY RANGE (captured_at);
CREATE TABLE fleet_position_history_default PARTITION OF fleet_position_history DEFAULT;
CREATE INDEX fleet_position_history_session_time_idx
  ON fleet_position_history (tenant_id, session_id, captured_at DESC);
CREATE INDEX fleet_position_history_trip_time_idx
  ON fleet_position_history (tenant_id, trip_id, captured_at DESC);

CREATE TABLE fleet_current_positions (
  tenant_id text NOT NULL,
  branch_id text NOT NULL,
  trip_id text NOT NULL,
  session_id text NOT NULL,
  device_id text NOT NULL,
  vehicle_resource_id text NOT NULL,
  event_id text NOT NULL,
  sequence bigint NOT NULL CHECK (sequence >= 0),
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_metres double precision NOT NULL CHECK (accuracy_metres BETWEEN 0 AND 250),
  speed_metres_per_second double precision CHECK (speed_metres_per_second BETWEEN 0 AND 70),
  heading_degrees double precision CHECK (heading_degrees >= 0 AND heading_degrees < 360),
  battery_percent double precision CHECK (battery_percent BETWEEN 0 AND 100),
  PRIMARY KEY (tenant_id, session_id),
  UNIQUE (tenant_id, event_id),
  FOREIGN KEY (tenant_id, event_id) REFERENCES fleet_telemetry_receipts (tenant_id, event_id),
  FOREIGN KEY (tenant_id, session_id, branch_id, trip_id, device_id, vehicle_resource_id)
    REFERENCES fleet_tracking_sessions (tenant_id, id, branch_id, trip_id, device_id, vehicle_resource_id)
);
CREATE INDEX fleet_current_positions_branch_idx
  ON fleet_current_positions (tenant_id, branch_id, captured_at DESC);
CREATE INDEX fleet_current_positions_trip_idx
  ON fleet_current_positions (tenant_id, trip_id);

ALTER TABLE tenant_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_trip_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_telemetry_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_position_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_position_history_default ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_current_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_branches FORCE ROW LEVEL SECURITY;
ALTER TABLE transport_trip_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE fleet_devices FORCE ROW LEVEL SECURITY;
ALTER TABLE fleet_tracking_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE fleet_telemetry_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE fleet_position_history FORCE ROW LEVEL SECURITY;
ALTER TABLE fleet_position_history_default FORCE ROW LEVEL SECURITY;
ALTER TABLE fleet_current_positions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_branches_isolation ON tenant_branches USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY transport_trip_assignments_isolation ON transport_trip_assignments USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY fleet_devices_isolation ON fleet_devices USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY fleet_tracking_sessions_isolation ON fleet_tracking_sessions USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY fleet_telemetry_receipts_isolation ON fleet_telemetry_receipts USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY fleet_position_history_isolation ON fleet_position_history USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY fleet_position_history_default_isolation ON fleet_position_history_default USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY fleet_current_positions_isolation ON fleet_current_positions USING (tenant_id = current_setting('booking.tenant_id', true));
