-- Preserve typed requirement assignments on public holds for confirmation-time revalidation.
ALTER TABLE booking_holds ADD COLUMN service_id text;
ALTER TABLE booking_holds ADD COLUMN variant_id text;
ALTER TABLE booking_holds ADD COLUMN requirement_assignments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE booking_holds ADD CONSTRAINT booking_holds_requirement_assignments_array CHECK (jsonb_typeof(requirement_assignments) = 'array');
