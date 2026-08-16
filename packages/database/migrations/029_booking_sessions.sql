-- Ownership: opaque server-side sessions; only hashes are stored.

CREATE TABLE booking_sessions (
  token_hash TEXT PRIMARY KEY,
  identity_issuer TEXT NOT NULL,
  identity_subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES local_users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX booking_sessions_active_expiry_idx
  ON booking_sessions (expires_at)
  WHERE revoked_at IS NULL;
