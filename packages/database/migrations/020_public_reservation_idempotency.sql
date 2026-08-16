-- Retry-safe public occurrence reservations use a tenant-scoped idempotency key.
ALTER TABLE service_reservations ADD COLUMN create_idempotency_key text;
CREATE UNIQUE INDEX service_reservations_create_idempotency_idx ON service_reservations (tenant_id, create_idempotency_key) WHERE create_idempotency_key IS NOT NULL;
