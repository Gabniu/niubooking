-- Communication jobs may target a universal occurrence reservation as well as an appointment booking.
ALTER TABLE communication_outbox ADD COLUMN occurrence_id text;
ALTER TABLE communication_outbox ADD COLUMN reservation_id text;
CREATE INDEX communication_outbox_occurrence_idx ON communication_outbox (tenant_id, occurrence_id, reservation_id) WHERE occurrence_id IS NOT NULL;
