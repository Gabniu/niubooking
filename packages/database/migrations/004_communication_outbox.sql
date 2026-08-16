CREATE TABLE communication_outbox (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('reminder', 'feedback')),
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'voice')),
  idempotency_key text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'claimed', 'sent', 'failed', 'suppressed', 'cancelled')),
  booking_id text,
  customer_id text NOT NULL,
  claimed_at timestamptz,
  completed_at timestamptz,
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX communication_outbox_due_idx ON communication_outbox (status, scheduled_for);
ALTER TABLE communication_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY communication_outbox_tenant_isolation ON communication_outbox USING (tenant_id = current_setting('booking.tenant_id', true));
