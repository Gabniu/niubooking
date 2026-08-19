-- Optional seat labels assigned after reservation; open-capacity trips keep an empty label array.
ALTER TABLE transport_trip_reservations
  ADD COLUMN seat_labels text[] NOT NULL DEFAULT '{}';
ALTER TABLE transport_trip_reservations
  ADD CONSTRAINT transport_trip_reservations_seat_labels_array CHECK (array_ndims(seat_labels) IS NULL OR array_ndims(seat_labels) = 1);
CREATE INDEX transport_trip_reservations_seat_labels_idx
  ON transport_trip_reservations (tenant_id, trip_id)
  WHERE cardinality(seat_labels) > 0;
