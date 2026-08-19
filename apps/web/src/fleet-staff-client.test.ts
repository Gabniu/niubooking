// Ownership: focused contract mapping proof for the staff fleet client.
import assert from "node:assert/strict";
import test from "node:test";
import { fetchFleetCurrent } from "./fleet-staff-client.js";

test("loads privacy-safe current fleet projections", async () => {
  const state = await fetchFleetCurrent(async (url) => { assert.match(url, /fleet\/current$/u); return { status: 200, json: async () => ({ data: [{ tripId: "trip-1", branchId: "branch-1", vehicleLabel: "Vehicle 4", routeLabel: "CBD loop", capturedAt: "2026-08-19T10:00:00.000Z", freshness: "live", latitude: -1.28, longitude: 36.81, accuracyMetres: 8, headingDegrees: 90, eta: null }], error: null }) }; }, "https://booking.test", "tenant-1");
  assert.equal(state.kind, "ready");
  if (state.kind === "ready") assert.equal(state.value[0]?.vehicleLabel, "Vehicle 4");
});

test("maps a fleet permission response without exposing API wording", async () => {
  const state = await fetchFleetCurrent(async () => ({ status: 403, json: async () => ({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "internal" } }) }), "https://booking.test", "tenant-1");
  assert.deepEqual(state, { kind: "denied", message: "You do not have access to these live vehicle locations." });
});

test("keeps unavailable fleet data retryable", async () => {
  const state = await fetchFleetCurrent(async () => ({ status: 503, json: async () => ({ data: null, error: { code: "LIVE_FLEET_UNAVAILABLE", message: "internal" } }) }), "https://booking.test", "tenant-1");
  assert.deepEqual(state, { kind: "error", message: "Live vehicle locations are temporarily unavailable. Please try again." });
});
