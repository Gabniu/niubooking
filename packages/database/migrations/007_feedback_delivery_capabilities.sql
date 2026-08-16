ALTER TABLE communication_outbox
  ADD COLUMN campaign_id text,
  ADD COLUMN template_version integer,
  ADD COLUMN feedback_expires_at timestamptz;

ALTER TABLE feedback_response_capabilities
  ADD COLUMN source_job_id text UNIQUE;
