-- Ownership: short-lived, revocable public rider capabilities. Only token hashes are stored.
CREATE TABLE transport_live_viewer_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  tenant_id text NOT NULL,
  ticket_id text NOT NULL,
  trip_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX transport_live_viewer_sessions_active_idx
  ON transport_live_viewer_sessions (tenant_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX transport_live_viewer_sessions_ticket_idx
  ON transport_live_viewer_sessions (tenant_id, ticket_id, expires_at DESC);
ALTER TABLE transport_live_viewer_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY transport_live_viewer_sessions_tenant_isolation
  ON transport_live_viewer_sessions
  USING (tenant_id = current_setting('booking.tenant_id', true));
