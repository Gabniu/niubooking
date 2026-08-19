-- Immutable fare snapshots and deterministic opaque ticket tokens.
CREATE TABLE transport_tickets (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  trip_id text NOT NULL,
  reservation_id text NOT NULL,
  ticket_token_hash text NOT NULL,
  fare_amount_minor integer NOT NULL CHECK (fare_amount_minor >= 0),
  fare_currency text NOT NULL CHECK (fare_currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  UNIQUE (tenant_id, ticket_token_hash),
  UNIQUE (tenant_id, reservation_id),
  FOREIGN KEY (tenant_id, trip_id) REFERENCES transport_trips (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, reservation_id) REFERENCES service_reservations (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX transport_tickets_trip_idx ON transport_tickets (tenant_id, trip_id, issued_at, id);
ALTER TABLE transport_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY transport_tickets_tenant_isolation ON transport_tickets USING (tenant_id = current_setting('booking.tenant_id', true));
