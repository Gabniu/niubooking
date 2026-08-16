-- Typed resource capabilities let universal requirement slots match industry pack needs.
ALTER TABLE booking_resources ADD COLUMN capabilities text[] NOT NULL DEFAULT '{}';
ALTER TABLE booking_resources ADD CONSTRAINT booking_resources_capabilities_bounded CHECK (cardinality(capabilities) <= 32);
CREATE INDEX booking_resources_capabilities_idx ON booking_resources USING gin (capabilities);
