// Ownership: focused proof for the staff fleet view's client-side filter semantics.
import assert from "node:assert/strict";
import test from "node:test";
import { filterFleetVehicles, type FleetFilters } from "../app/components/fleet-operations-filters.js";
import type { LiveVehicleProjection } from "@bookingapp/contracts";

const vehicles: readonly LiveVehicleProjection[] = [
  { tripId: "trip-1", branchId: "branch-1", vehicleLabel: "Matatu 1", routeLabel: "CBD", capturedAt: "2026-08-20T08:00:00.000Z", freshness: "live", latitude: -1.28, longitude: 36.81, accuracyMetres: 8, headingDegrees: 90, eta: null },
  { tripId: "trip-2", branchId: "branch-1", vehicleLabel: "Bus 2", routeLabel: "Westlands", capturedAt: "2026-08-20T07:55:00.000Z", freshness: "delayed", latitude: -1.27, longitude: 36.8, accuracyMetres: 18, headingDegrees: 180, eta: null },
];

test("filters fleet vehicles by route and signal without changing the source snapshot", () => {
  const filters: FleetFilters = { query: "", route: "CBD", freshness: "live" };
  const result = filterFleetVehicles(vehicles, filters);
  assert.deepEqual(result.map((vehicle) => vehicle.tripId), ["trip-1"]);
  assert.equal(vehicles.length, 2);
});

test("search matches vehicle, route, and trip identifiers case-insensitively", () => {
  assert.equal(filterFleetVehicles(vehicles, { query: "west", route: "all", freshness: "all" })[0]?.vehicleLabel, "Bus 2");
  assert.equal(filterFleetVehicles(vehicles, { query: "TRIP-1", route: "all", freshness: "all" })[0]?.tripId, "trip-1");
});

test("all filters return the complete authorized snapshot", () => {
  assert.equal(filterFleetVehicles(vehicles, { query: "", route: "all", freshness: "all" }).length, 2);
});
