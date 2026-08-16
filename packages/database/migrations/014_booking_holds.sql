-- Expiring public booking holds. Tokens are represented only by a hash.
CREATE TABLE booking_holds (
  hold_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  public_code text NOT NULL,
  hold_token_hash text NOT NULL,
  customer_name text NOT NULL,
  service_name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'confirmed', 'expired')),
  booking_id text,
  create_idempotency_key text NOT NULL,
  confirm_idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_holds_time_order CHECK (ends_at > starts_at),
  CONSTRAINT booking_holds_tenant_booking_fk FOREIGN KEY (tenant_id, booking_id) REFERENCES bookings (tenant_id, id)
);
CREATE UNIQUE INDEX booking_holds_create_idempotency_idx ON booking_holds (tenant_id, create_idempotency_key);
CREATE UNIQUE INDEX booking_holds_confirm_idempotency_idx ON booking_holds (tenant_id, confirm_idempotency_key) WHERE confirm_idempotency_key IS NOT NULL;
CREATE INDEX booking_holds_expiry_idx ON booking_holds (tenant_id, expires_at, status);
ALTER TABLE booking_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_holds_tenant_isolation ON booking_holds USING (tenant_id = current_setting('booking.tenant_id', true));
