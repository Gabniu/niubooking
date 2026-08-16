-- Short-lived, single-use contact verification. Only a hash of the code is persisted.
CREATE TABLE contact_verification_challenges (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  contact_method_id text NOT NULL,
  customer_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'voice')),
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_verification_active_idx ON contact_verification_challenges (tenant_id, contact_method_id, expires_at);
ALTER TABLE contact_verification_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_verification_tenant_isolation ON contact_verification_challenges USING (tenant_id = current_setting('booking.tenant_id', true));
