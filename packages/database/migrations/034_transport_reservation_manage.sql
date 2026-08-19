-- Revocable opaque capability for a passenger to cancel a transport reservation.
ALTER TABLE transport_trip_reservations ADD COLUMN manage_token_hash text;
ALTER TABLE transport_trip_reservations ADD COLUMN manage_token_expires_at timestamptz;
CREATE UNIQUE INDEX transport_trip_reservations_manage_token_idx
  ON transport_trip_reservations (manage_token_hash)
  WHERE manage_token_hash IS NOT NULL;
