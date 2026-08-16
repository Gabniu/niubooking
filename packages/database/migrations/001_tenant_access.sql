-- Ownership: first tenant-safe Booking persistence boundary.

CREATE TABLE local_users (
  id TEXT PRIMARY KEY,
  identity_issuer TEXT NOT NULL,
  identity_subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (identity_issuer, identity_subject)
);

CREATE TABLE tenant_memberships (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES local_users(id),
  branch_ids TEXT[] NOT NULL DEFAULT '{}',
  role TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_membership_isolation ON tenant_memberships
  USING (tenant_id = current_setting('booking.tenant_id', true));
