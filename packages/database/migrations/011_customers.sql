-- Canonical tenant-scoped customer subject. Industry-specific attributes belong in Industry Packs.
CREATE TABLE customers (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 200),
  preferred_locale text,
  timezone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX customers_tenant_status_idx ON customers (tenant_id, status, display_name);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_tenant_isolation ON customers USING (tenant_id = current_setting('booking.tenant_id', true));
