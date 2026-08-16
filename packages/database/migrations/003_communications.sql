-- Communication preferences and workflows are tenant-owned and versioned.
CREATE TABLE communication_settings (
  tenant_id text PRIMARY KEY,
  timezone text NOT NULL DEFAULT 'UTC',
  reminders_enabled boolean NOT NULL DEFAULT true,
  feedback_enabled boolean NOT NULL DEFAULT true,
  default_feedback_frequency_days integer NOT NULL DEFAULT 30 CHECK (default_feedback_frequency_days > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reminder_rules (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES communication_settings(tenant_id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  minutes_before integer NOT NULL CHECK (minutes_before > 0),
  channels text[] NOT NULL CHECK (cardinality(channels) > 0),
  quiet_hours_start time,
  quiet_hours_end time,
  frequency_cap_hours integer NOT NULL DEFAULT 24 CHECK (frequency_cap_hours > 0)
);

CREATE TABLE feedback_campaigns (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  audience text NOT NULL CHECK (audience IN ('any-client', 'completed-appointment', 'campaign')),
  template_version integer NOT NULL CHECK (template_version > 0),
  frequency_cap_days integer NOT NULL CHECK (frequency_cap_days > 0),
  expires_after_days integer NOT NULL CHECK (expires_after_days > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE communication_opt_outs (
  tenant_id text NOT NULL,
  customer_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'voice')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, customer_id, channel)
);

CREATE TABLE communication_delivery_attempts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  idempotency_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'voice')),
  kind text NOT NULL CHECK (kind IN ('reminder', 'feedback')),
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'suppressed')),
  provider_reference text,
  attempted_at timestamptz,
  UNIQUE (tenant_id, idempotency_key)
);

ALTER TABLE communication_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_delivery_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY communication_settings_tenant_isolation ON communication_settings USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY reminder_rules_tenant_isolation ON reminder_rules USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY feedback_campaigns_tenant_isolation ON feedback_campaigns USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY communication_opt_outs_tenant_isolation ON communication_opt_outs USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY communication_delivery_tenant_isolation ON communication_delivery_attempts USING (tenant_id = current_setting('booking.tenant_id', true));
