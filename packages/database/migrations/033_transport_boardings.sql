-- Append-only boarding evidence for conductor actions.
CREATE TABLE transport_boardings (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  trip_id text NOT NULL,
  reservation_id text NOT NULL,
  ticket_id text NOT NULL,
  actor_id text,
  action text NOT NULL DEFAULT 'boarded' CHECK (action IN ('boarded')),
  idempotency_key text NOT NULL,
  boarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ticket_id, action),
  UNIQUE (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, trip_id) REFERENCES transport_trips (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, reservation_id) REFERENCES service_reservations (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, ticket_id) REFERENCES transport_tickets (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX transport_boardings_trip_idx ON transport_boardings (tenant_id, trip_id, boarded_at, id);
ALTER TABLE transport_boardings ENABLE ROW LEVEL SECURITY;
CREATE POLICY transport_boardings_tenant_isolation ON transport_boardings USING (tenant_id = current_setting('booking.tenant_id', true));
