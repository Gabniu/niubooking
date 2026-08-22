-- Ownership: session-scoped provider credentials; raw secrets never persist.

ALTER TABLE fleet_tracking_sessions
  ADD COLUMN traccar_credential_hash text
  CHECK (traccar_credential_hash IS NULL OR traccar_credential_hash ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX fleet_tracking_session_traccar_hash_idx
  ON fleet_tracking_sessions (traccar_credential_hash)
  WHERE traccar_credential_hash IS NOT NULL;
