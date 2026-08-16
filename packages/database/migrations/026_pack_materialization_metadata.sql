-- Pack-seeded catalog rows retain their source version for explicit future upgrades.
ALTER TABLE industry_pack_events DROP CONSTRAINT IF EXISTS industry_pack_events_action_check;
ALTER TABLE industry_pack_events ADD CONSTRAINT industry_pack_events_action_check CHECK (action IN ('selected', 'overrides_updated', 'materialized'));
ALTER TABLE service_definitions ADD COLUMN pack_version text;
ALTER TABLE service_variants ADD COLUMN pack_id text;
ALTER TABLE service_variants ADD COLUMN pack_version text;
ALTER TABLE service_requirements ADD COLUMN pack_id text;
ALTER TABLE service_requirements ADD COLUMN pack_version text;
