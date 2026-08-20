// Ownership: GTFS-Realtime freshness, reference, and privacy-safe projection tests.

import assert from "node:assert/strict";
import test from "node:test";
import {
  validateGtfsRealtimeAlert,
  validateGtfsRealtimeTripUpdate,
  validateGtfsRealtimeVehiclePosition,
  buildGtfsRealtimeVehiclePositions,
  type GtfsPublishedReferences,
  type GtfsRealtimeVehiclePosition,
} from "./gtfs-realtime.js";
import { serializeGtfsRealtimeVehiclePositions } from "./gtfs-realtime-protobuf.js";
import { readGtfsScheduleReferences } from "./gtfs-validation.js";

const now = new Date("2026-08-19T12:00:00Z");
const published: GtfsPublishedReferences = {
  scheduleVersion: "2026-08-19.1",
  routeIds: new Set(["route-23"]),
  tripIds: new Set(["route-23-pattern-a"]),
  stopIds: new Set(["cbd", "westlands"]),
};
const position: GtfsRealtimeVehiclePosition = {
  entityPublicId: "vehicle-position-11",
  vehiclePublicId: "vehicle-11",
  trip: {
    tripPublicId: "route-23-pattern-a",
    routePublicId: "route-23",
    startDate: "20260819",
    startTime: "11:45:00",
    scheduleRelationship: "unscheduled",
  },
  latitude: -1.28,
  longitude: 36.82,
  bearing: 280,
  speedMetresPerSecond: 8,
  capturedAt: new Date("2026-08-19T11:59:45Z"),
  currentStopSequence: 1,
  stopPublicId: "cbd",
  occupancyStatus: "few_seats_available",
};

test("accepts a fresh headway vehicle whose IDs resolve in the active feed", () => {
  assert.deepEqual(validateGtfsRealtimeVehiclePosition(position, published, now), []);
  assert.equal("driverId" in position, false);
  assert.equal("deviceId" in position, false);
});

test("rejects stale, unknown, and ambiguous headway vehicle positions", () => {
  const { startTime: _startTime, ...ambiguousTrip } = position.trip;
  const broken = {
    ...position,
    capturedAt: new Date("2026-08-19T11:58:00Z"),
    stopPublicId: "private-stop-id",
    trip: { ...ambiguousTrip, tripPublicId: "private-trip-id" },
  };
  const errors = validateGtfsRealtimeVehiclePosition(broken, published, now).join("; ");
  assert.match(errors, /active Schedule|start time|too old/iu);
});

test("validates ordered trip updates against published stops", () => {
  assert.deepEqual(validateGtfsRealtimeTripUpdate({
    entityPublicId: "trip-update-23",
    trip: position.trip,
    capturedAt: position.capturedAt,
    stopUpdates: [
      { stopPublicId: "cbd", stopSequence: 1, departureAt: new Date("2026-08-19T12:01:00Z") },
      { stopPublicId: "westlands", stopSequence: 2, arrivalAt: new Date("2026-08-19T12:20:00Z") },
    ],
  }, published, now), []);
});

test("validates alert selectors and active periods", () => {
  assert.deepEqual(validateGtfsRealtimeAlert({
    entityPublicId: "alert-road-closure",
    headerText: "Road closure",
    routePublicIds: ["route-23"],
    activeFrom: now,
    activeUntil: new Date("2026-08-19T14:00:00Z"),
  }, published), []);
  assert.match(validateGtfsRealtimeAlert({
    entityPublicId: "alert-bad",
    headerText: "Changed stop",
    stopPublicIds: ["missing"],
  }, published).join("; "), /unknown stop/iu);
});

test("builds a deterministic privacy-safe VehiclePositions feed and drops stale candidates", () => {
  const generatedAt = new Date("2026-08-19T12:00:00Z");
  const result = buildGtfsRealtimeVehiclePositions({
    scheduleVersion: "2026-08-19.1", generatedAt, published,
    candidates: [
      { entityPublicId: "vp-b", vehiclePublicId: "vehicle-b", tripPublicId: "route-23-pattern-a", routePublicId: "route-23", startDate: "20260819", latitude: -1.2, longitude: 36.8, capturedAt: new Date("2026-08-19T11:59:45Z") },
      { entityPublicId: "vp-a", vehiclePublicId: "vehicle-a", tripPublicId: "missing-trip", routePublicId: "route-23", startDate: "20260819", latitude: -1.2, longitude: 36.8, capturedAt: new Date("2026-08-19T11:59:45Z") },
    ],
  });
  assert.deepEqual(result.feed.entities.map((entity) => entity.entityPublicId), ["vp-b"]);
  assert.equal(result.dropped[0]?.entityPublicId, "vp-a");
  const encoded = serializeGtfsRealtimeVehiclePositions(result.feed);
  assert.ok(encoded.length > 20);
  assert.match(new TextDecoder().decode(encoded), /2\.0/iu);
});

test("snapshots only public route, trip, and stop IDs from a validated Schedule", () => {
  const references = readGtfsScheduleReferences([
    { fileName: "routes.txt", content: "route_id,agency_id,route_type\nroute-1,agency-1,3\n" },
    { fileName: "trips.txt", content: "route_id,service_id,trip_id\nroute-1,service-1,trip-1\n" },
    { fileName: "stops.txt", content: "stop_id,stop_name,stop_lat,stop_lon\nstop-1,One,0,0\n" },
  ], "version-1");
  assert.deepEqual([...references.routeIds], ["route-1"]);
  assert.deepEqual([...references.tripIds], ["trip-1"]);
  assert.deepEqual([...references.stopIds], ["stop-1"]);
});
