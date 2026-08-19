-- Tenant-scoped, versioned transport routes and dated trips on the occurrence kernel.
CREATE TABLE transport_routes (
  id text NOT NULL,
  tenant_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('bus', 'matatu', 'shuttle', 'charter')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id, version)
);
CREATE INDEX transport_routes_tenant_status_idx ON transport_routes (tenant_id, status, name, id, version);

CREATE TABLE transport_route_stops (
  tenant_id text NOT NULL,
  route_id text NOT NULL,
  route_version integer NOT NULL,
  stop_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  boarding_minutes integer NOT NULL DEFAULT 0 CHECK (boarding_minutes >= 0),
  alighting_minutes integer NOT NULL DEFAULT 0 CHECK (alighting_minutes >= 0),
  PRIMARY KEY (tenant_id, route_id, route_version, sequence),
  UNIQUE (tenant_id, route_id, route_version, stop_id),
  FOREIGN KEY (tenant_id, route_id, route_version) REFERENCES transport_routes (tenant_id, id, version) ON DELETE CASCADE
);

CREATE TABLE transport_trips (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  route_id text NOT NULL,
  route_version integer NOT NULL,
  occurrence_id text NOT NULL,
  capacity_mode text NOT NULL CHECK (capacity_mode IN ('seat', 'open')),
  capacity integer NOT NULL CHECK (capacity > 0),
  boarding_starts_at timestamptz NOT NULL,
  boarding_ends_at timestamptz NOT NULL,
  vehicle_resource_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, route_id, route_version) REFERENCES transport_routes (tenant_id, id, version),
  FOREIGN KEY (tenant_id, occurrence_id) REFERENCES service_occurrences (tenant_id, id),
  FOREIGN KEY (tenant_id, vehicle_resource_id) REFERENCES booking_resources (tenant_id, id),
  CHECK (boarding_ends_at > boarding_starts_at)
);
CREATE INDEX transport_trips_tenant_boarding_idx ON transport_trips (tenant_id, boarding_starts_at, boarding_ends_at);
ALTER TABLE transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY transport_routes_tenant_isolation ON transport_routes USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY transport_route_stops_tenant_isolation ON transport_route_stops USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY transport_trips_tenant_isolation ON transport_trips USING (tenant_id = current_setting('booking.tenant_id', true));
