CREATE TABLE feedback_templates (
  campaign_id text NOT NULL,
  tenant_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL,
  intro text NOT NULL,
  questions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, version)
);

CREATE TABLE feedback_response_capabilities (
  capability_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  campaign_id text NOT NULL,
  template_version integer NOT NULL,
  customer_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE feedback_responses (
  capability_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  campaign_id text NOT NULL,
  template_version integer NOT NULL,
  customer_id text NOT NULL,
  answers jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_response_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY feedback_templates_tenant_isolation ON feedback_templates USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY feedback_capabilities_tenant_isolation ON feedback_response_capabilities USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY feedback_responses_tenant_isolation ON feedback_responses USING (tenant_id = current_setting('booking.tenant_id', true));
