-- Universal dated service occurrences and quantity-based reservations.
CREATE TABLE service_occurrences (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  service_id text NOT NULL,
  label text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'open', 'closed', 'cancelled', 'completed')),
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0 AND (capacity IS NULL OR reserved_quantity <= capacity)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CHECK (ends_at > starts_at)
);
CREATE INDEX service_occurrences_tenant_time_idx ON service_occurrences (tenant_id, starts_at, ends_at);
ALTER TABLE service_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_occurrences_tenant_isolation ON service_occurrences USING (tenant_id = current_setting('booking.tenant_id', true));

CREATE TABLE service_reservations (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  occurrence_id text NOT NULL,
  customer_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('held', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, occurrence_id) REFERENCES service_occurrences (tenant_id, id)
);
CREATE INDEX service_reservations_occurrence_idx ON service_reservations (tenant_id, occurrence_id, status);
CREATE INDEX service_reservations_customer_idx ON service_reservations (tenant_id, customer_id, created_at);
ALTER TABLE service_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_reservations_tenant_isolation ON service_reservations USING (tenant_id = current_setting('booking.tenant_id', true));
