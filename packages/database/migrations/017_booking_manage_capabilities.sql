-- Opaque public manage capability and idempotent reschedule/cancel actions.
ALTER TABLE bookings ADD COLUMN manage_token_hash text;
ALTER TABLE bookings ADD COLUMN manage_token_expires_at timestamptz;
CREATE UNIQUE INDEX bookings_manage_token_hash_idx ON bookings (manage_token_hash) WHERE manage_token_hash IS NOT NULL;
CREATE TABLE booking_manage_actions (
  tenant_id text NOT NULL,
  booking_id text NOT NULL,
  idempotency_key text NOT NULL,
  action text NOT NULL CHECK (action IN ('reschedule', 'cancel')),
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, idempotency_key),
  FOREIGN KEY (tenant_id, booking_id) REFERENCES bookings (tenant_id, id) ON DELETE CASCADE
);
ALTER TABLE booking_manage_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_manage_actions_tenant_isolation ON booking_manage_actions USING (tenant_id = current_setting('booking.tenant_id', true));
