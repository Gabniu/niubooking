-- Named/geocoded stops and bounded route geometry for privacy-safe map projections.
ALTER TABLE transport_routes ADD COLUMN geometry jsonb;
ALTER TABLE transport_routes ADD CONSTRAINT transport_routes_geometry_shape_check
  CHECK (geometry IS NULL OR (
    jsonb_typeof(geometry) = 'object'
    AND geometry ->> 'type' = 'LineString'
    AND jsonb_typeof(geometry -> 'coordinates') = 'array'
  ));

ALTER TABLE transport_route_stops ADD COLUMN label text;
ALTER TABLE transport_route_stops ADD COLUMN latitude double precision;
ALTER TABLE transport_route_stops ADD COLUMN longitude double precision;
ALTER TABLE transport_route_stops ADD CONSTRAINT transport_route_stops_label_check
  CHECK (label IS NULL OR length(trim(label)) BETWEEN 1 AND 200);
ALTER TABLE transport_route_stops ADD CONSTRAINT transport_route_stops_coordinate_pair_check
  CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180));
