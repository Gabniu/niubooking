-- Tenant-selected, schema-limited pack configuration and append-only selection evidence.
CREATE TABLE industry_pack_settings (
  tenant_id text PRIMARY KEY,
  pack_id text NOT NULL,
  pack_version text NOT NULL,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(overrides) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE industry_pack_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  actor_id text,
  action text NOT NULL CHECK (action IN ('selected', 'overrides_updated')),
  pack_id text NOT NULL,
  pack_version text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX industry_pack_events_tenant_time_idx ON industry_pack_events (tenant_id, occurred_at DESC, id DESC);
ALTER TABLE industry_pack_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_pack_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY industry_pack_settings_tenant_isolation ON industry_pack_settings USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY industry_pack_events_tenant_isolation ON industry_pack_events USING (tenant_id = current_setting('booking.tenant_id', true));
