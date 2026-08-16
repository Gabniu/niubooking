-- Immutable tenant-scoped mutation evidence. Payloads are scalar and contain no contact destinations.
CREATE TABLE audit_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'system', 'integration')),
  actor_id text,
  action text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('reservation')),
  entity_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_tenant_time_idx ON audit_events (tenant_id, occurred_at DESC, id DESC);
CREATE INDEX audit_events_entity_idx ON audit_events (tenant_id, entity_type, entity_id, occurred_at DESC);
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_events_tenant_isolation ON audit_events USING (tenant_id = current_setting('booking.tenant_id', true));
