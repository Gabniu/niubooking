-- Verification messages are immediate ephemeral deliveries; only their hashed challenge is persisted.
ALTER TABLE communication_outbox DROP CONSTRAINT IF EXISTS communication_outbox_kind_check;
ALTER TABLE communication_outbox ADD CONSTRAINT communication_outbox_kind_check CHECK (kind IN ('reminder', 'feedback', 'verification'));
ALTER TABLE communication_delivery_attempts DROP CONSTRAINT IF EXISTS communication_delivery_attempts_kind_check;
ALTER TABLE communication_delivery_attempts ADD CONSTRAINT communication_delivery_attempts_kind_check CHECK (kind IN ('reminder', 'feedback', 'verification'));
