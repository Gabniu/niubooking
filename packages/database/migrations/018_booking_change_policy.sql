-- Organization-controlled rules for public appointment changes.
ALTER TABLE communication_settings
  ADD COLUMN reschedule_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN cancellation_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN minimum_change_notice_minutes integer NOT NULL DEFAULT 0 CHECK (minimum_change_notice_minutes >= 0 AND minimum_change_notice_minutes <= 43200);
