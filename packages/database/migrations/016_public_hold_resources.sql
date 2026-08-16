-- Preserve the advisory resource selection across an expiring public hold.
ALTER TABLE booking_holds ADD COLUMN resource_ids text[] NOT NULL DEFAULT '{}';
