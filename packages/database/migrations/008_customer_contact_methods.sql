-- Contact destinations are tenant-owned and resolved only at delivery time.
-- The outbox stores customer_id, never destination values.
CREATE TABLE customer_contact_methods (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  customer_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'voice')),
  destination text NOT NULL CHECK (char_length(destination) BETWEEN 1 AND 320),
  consent_status text NOT NULL CHECK (consent_status IN ('granted', 'denied', 'unknown')),
  verified_at timestamptz,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 1 CHECK (priority > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, customer_id, channel, destination)
);

CREATE INDEX customer_contact_methods_lookup_idx
  ON customer_contact_methods (tenant_id, customer_id, channel, enabled, consent_status, priority);

ALTER TABLE customer_contact_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_contact_methods_tenant_isolation
  ON customer_contact_methods
  USING (tenant_id = current_setting('booking.tenant_id', true));
