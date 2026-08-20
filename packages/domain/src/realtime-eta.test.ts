import assert from "node:assert/strict";
import test from "node:test";
import { estimateRouteEta } from "./realtime-eta.js";

const now = new Date("2026-08-20T10:00:00.000Z");
const input = { geometry: { type: "LineString" as const, coordinates: [[0, 0], [0.01, 0]] as const }, stops: [{ sequence: 1, latitude: 0, longitude: 0, boardingMinutes: 0, alightingMinutes: 0 }, { sequence: 2, latitude: 0, longitude: 0.01, boardingMinutes: 0, alightingMinutes: 0 }], destinationStopSequence: 2, latitude: 0, longitude: 0, accuracyMetres: 8, speedMetresPerSecond: 10, capturedAt: now, freshness: "live" as const, now };

test("estimates a bounded route arrival range from trusted telemetry", () => {
  const result = estimateRouteEta(input);
  assert.ok(result);
  assert.equal(result.confidence, "high");
  assert.ok(result.earliestArrival > now);
  assert.ok(result.latestArrival > result.earliestArrival);
  assert.ok(result.distanceMetres > 1_000);
});

test("returns no ETA when route context is insufficient or stale", () => {
  assert.equal(estimateRouteEta({ ...input, geometry: null }), null);
  assert.equal(estimateRouteEta({ ...input, stops: [{ ...input.stops[0]! }], destinationStopSequence: 2 }), null);
  assert.equal(estimateRouteEta({ ...input, capturedAt: new Date(now.getTime() - 121_000), freshness: "delayed" }), null);
});

test("does not report a destination that is already behind the vehicle", () => {
  assert.equal(estimateRouteEta({ ...input, latitude: 0, longitude: 0.02 }), null);
});
