-- QR destinations are opaque public entry points; they never store arbitrary redirect URLs.
CREATE TABLE qr_destinations (
  public_code text PRIMARY KEY CHECK (length(public_code) BETWEEN 16 AND 96),
  tenant_id text NOT NULL,
  branch_id text,
  pack_id text,
  service_id text,
  campaign text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked', 'expired')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX qr_destinations_tenant_status_idx ON qr_destinations (tenant_id, status);
ALTER TABLE qr_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY qr_destinations_tenant_isolation ON qr_destinations
  USING (tenant_id = current_setting('booking.tenant_id', true));
