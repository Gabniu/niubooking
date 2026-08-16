-- Tenant-scoped schedulable resources and conflict-safe booking allocations.
CREATE TABLE booking_resources (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL,
  resource_type text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE booking_resource_allocations (
  tenant_id text NOT NULL,
  booking_id text NOT NULL,
  resource_id text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  PRIMARY KEY (tenant_id, booking_id, resource_id),
  FOREIGN KEY (tenant_id, booking_id) REFERENCES bookings (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, resource_id) REFERENCES booking_resources (tenant_id, id),
  CHECK (ends_at > starts_at)
);
CREATE INDEX booking_resource_allocations_lookup_idx ON booking_resource_allocations (tenant_id, resource_id, starts_at, ends_at);
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE booking_resource_allocations ADD CONSTRAINT booking_resource_allocations_excl EXCLUDE USING gist (
  tenant_id WITH =,
  resource_id WITH =,
  tstzrange(starts_at, ends_at, '[)') WITH &&
) WHERE (status = 'scheduled');
ALTER TABLE booking_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_resource_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_resources_tenant_isolation ON booking_resources USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY booking_resource_allocations_tenant_isolation ON booking_resource_allocations USING (tenant_id = current_setting('booking.tenant_id', true));
