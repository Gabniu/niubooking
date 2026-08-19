-- Idempotent passenger reservations layered on transport trips and universal reservations.
ALTER TABLE transport_trips ADD COLUMN reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0 AND reserved_quantity <= capacity);

CREATE TABLE transport_trip_reservations (
  tenant_id text NOT NULL,
  trip_id text NOT NULL,
  reservation_id text NOT NULL,
  origin_stop_id text NOT NULL,
  destination_stop_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  create_idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, reservation_id),
  UNIQUE (tenant_id, create_idempotency_key),
  FOREIGN KEY (tenant_id, trip_id) REFERENCES transport_trips (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, reservation_id) REFERENCES service_reservations (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX transport_trip_reservations_trip_idx ON transport_trip_reservations (tenant_id, trip_id, created_at, reservation_id);
ALTER TABLE transport_trip_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY transport_trip_reservations_tenant_isolation ON transport_trip_reservations USING (tenant_id = current_setting('booking.tenant_id', true));
