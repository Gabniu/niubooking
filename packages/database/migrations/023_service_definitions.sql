-- Tenant-owned service catalog for appointments, classes, trips, and future pack composition.
CREATE TABLE service_definitions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL,
  description text,
  booking_mode text NOT NULL DEFAULT 'appointment' CHECK (booking_mode IN ('appointment', 'occurrence')),
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 1440),
  buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_before_minutes BETWEEN 0 AND 1440),
  buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_after_minutes BETWEEN 0 AND 1440),
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  currency text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  pack_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX service_definitions_tenant_status_idx ON service_definitions (tenant_id, status, name, id);
ALTER TABLE service_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_definitions_tenant_isolation ON service_definitions USING (tenant_id = current_setting('booking.tenant_id', true));
