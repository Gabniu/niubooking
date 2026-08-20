// Ownership: focused proof for aggregate route grouping and marker projection.
import assert from "node:assert/strict";
import test from "node:test";
import { buildFleetAggregateModel, projectFleetPoint } from "../app/components/fleet-aggregate-map-model.js";
import type { LiveVehicleProjection } from "@bookingapp/contracts";

const vehicle = (overrides: Partial<LiveVehicleProjection>): LiveVehicleProjection => ({ tripId: "trip-1", branchId: "branch-1", vehicleLabel: "Vehicle 1", routeLabel: "CBD", capturedAt: "2026-08-20T08:00:00.000Z", freshness: "live", latitude: -1.28, longitude: 36.81, accuracyMetres: 8, headingDegrees: 90, geometry: { type: "LineString", coordinates: [[36.81, -1.28], [36.82, -1.27]] }, eta: null, ...overrides });

test("groups vehicles on the same route while preserving each live marker", () => {
  const model = buildFleetAggregateModel([vehicle({ tripId: "trip-1" }), vehicle({ tripId: "trip-2", vehicleLabel: "Vehicle 2", latitude: -1.275, longitude: 36.815 })]);
  assert.equal(model.routes.length, 1);
  assert.deepEqual(model.routes[0]?.vehicleTripIds, ["trip-1", "trip-2"]);
  assert.equal(model.markers.length, 2);
  assert.ok(model.bounds);
});

test("falls back to geocoded stops and ignores incomplete marker coordinates", () => {
  const stopVehicle = vehicle({ geometry: null, latitude: null, longitude: null, stops: [{ stopId: "a", sequence: 1, boardingMinutes: 0, alightingMinutes: 0, latitude: -1.3, longitude: 36.8 }, { stopId: "b", sequence: 2, boardingMinutes: 0, alightingMinutes: 0, latitude: -1.29, longitude: 36.81 }] });
  const noPosition = vehicle({ tripId: "trip-2", latitude: null, longitude: null });
  const model = buildFleetAggregateModel([stopVehicle, noPosition]);
  assert.equal(model.routes.length, 1);
  assert.equal(model.markers.length, 0);
});

test("projects points into a padded viewBox with stable degenerate-axis handling", () => {
  const projected = projectFleetPoint([36.81, -1.28], { minLongitude: 36.81, maxLongitude: 36.81, minLatitude: -1.28, maxLatitude: -1.28 });
  assert.deepEqual(projected, [50, 50]);
});
