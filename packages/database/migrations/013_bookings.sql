-- Tenant-scoped universal appointment source of truth.
CREATE TABLE bookings (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  customer_id text NOT NULL,
  service_name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_tenant_id_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT bookings_customer_fk FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id),
  CONSTRAINT bookings_time_order CHECK (ends_at > starts_at)
);
CREATE INDEX bookings_tenant_time_idx ON bookings (tenant_id, starts_at, ends_at);
CREATE INDEX bookings_customer_idx ON bookings (tenant_id, customer_id, starts_at);
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD CONSTRAINT bookings_customer_schedule_excl EXCLUDE USING gist (
  tenant_id WITH =,
  customer_id WITH =,
  tstzrange(starts_at, ends_at, '[)') WITH &&
) WHERE (status = 'scheduled');
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookings_tenant_isolation ON bookings USING (tenant_id = current_setting('booking.tenant_id', true));
