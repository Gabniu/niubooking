-- Service variants and neutral requirement slots; pack manifests may seed these rows.
CREATE TABLE service_variants (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  service_id text NOT NULL,
  name text NOT NULL,
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 5 AND 1440),
  buffer_before_minutes integer CHECK (buffer_before_minutes IS NULL OR buffer_before_minutes BETWEEN 0 AND 1440),
  buffer_after_minutes integer CHECK (buffer_after_minutes IS NULL OR buffer_after_minutes BETWEEN 0 AND 1440),
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  currency text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, service_id, id),
  FOREIGN KEY (tenant_id, service_id) REFERENCES service_definitions(tenant_id, id)
);
CREATE INDEX service_variants_service_idx ON service_variants (tenant_id, service_id, status, name, id);

CREATE TABLE service_requirements (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  service_id text NOT NULL,
  variant_id text,
  kind text NOT NULL DEFAULT 'resource' CHECK (kind IN ('resource')),
  label text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 16),
  resource_type text,
  capability_key text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CHECK (resource_type IS NOT NULL OR capability_key IS NOT NULL),
  FOREIGN KEY (tenant_id, service_id) REFERENCES service_definitions(tenant_id, id),
  FOREIGN KEY (tenant_id, service_id, variant_id) REFERENCES service_variants(tenant_id, service_id, id)
);
CREATE INDEX service_requirements_service_idx ON service_requirements (tenant_id, service_id, variant_id, status, id);

ALTER TABLE service_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_variants_tenant_isolation ON service_variants USING (tenant_id = current_setting('booking.tenant_id', true));
CREATE POLICY service_requirements_tenant_isolation ON service_requirements USING (tenant_id = current_setting('booking.tenant_id', true));
