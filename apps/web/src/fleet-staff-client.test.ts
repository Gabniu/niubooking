// Ownership: focused contract mapping proof for the staff fleet client.
import assert from "node:assert/strict";
import test from "node:test";
import { endFleetTrip, fetchFleetCrewStatus, fetchFleetCurrent, openFleetStream } from "./fleet-staff-client.js";

test("loads privacy-safe current fleet projections", async () => {
  const state = await fetchFleetCurrent(async (url) => { assert.match(url, /fleet\/current$/u); return { status: 200, json: async () => ({ data: [{ tripId: "trip-1", branchId: "branch-1", vehicleLabel: "Vehicle 4", routeLabel: "CBD loop", capturedAt: "2026-08-19T10:00:00.000Z", freshness: "live", latitude: -1.28, longitude: 36.81, accuracyMetres: 8, headingDegrees: 90, geometry: { type: "LineString", coordinates: [[36.81, -1.28], [36.82, -1.27]] }, stops: [{ stopId: "stop-1", label: "Town", sequence: 1, boardingMinutes: 0, alightingMinutes: 2, latitude: -1.28, longitude: 36.81 }], eta: null }], error: null }) }; }, "https://booking.test", "tenant-1");
  assert.equal(state.kind, "ready");
  if (state.kind === "ready") { assert.equal(state.value[0]?.vehicleLabel, "Vehicle 4"); assert.equal(state.value[0]?.stops?.[0]?.label, "Town"); }
});

test("maps a fleet permission response without exposing API wording", async () => {
  const state = await fetchFleetCurrent(async () => ({ status: 403, json: async () => ({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "internal" } }) }), "https://booking.test", "tenant-1");
  assert.deepEqual(state, { kind: "denied", message: "You do not have access to these live vehicle locations." });
});

test("keeps unavailable fleet data retryable", async () => {
  const state = await fetchFleetCurrent(async () => ({ status: 503, json: async () => ({ data: null, error: { code: "LIVE_FLEET_UNAVAILABLE", message: "internal" } }) }), "https://booking.test", "tenant-1");
  assert.deepEqual(state, { kind: "error", message: "Live vehicle locations are temporarily unavailable. Please try again." });
});

test("loads the signed-in crew status from the tenant-scoped endpoint", async () => {
  const state = await fetchFleetCrewStatus(async (url) => { assert.match(url, /fleet\/my-status$/u); return { status: 200, json: async () => ({ data: [{ assignmentId: "assignment-1", branchId: "branch-1", tripId: "trip-1", role: "driver", status: "active", assignedAt: "2030-01-01T08:00:00.000Z", endedAt: null, activeSession: null }], error: null }) }; }, "https://booking.test", "tenant-1");
  assert.equal(state.kind, "ready"); if (state.kind === "ready") assert.equal(state.value[0]?.tripId, "trip-1");
});

test("stops a manager-visible trip without exposing the session identifier", async () => {
  const state = await endFleetTrip(async (url, init) => { assert.match(url, /tracking-sessions\/end-trip$/u); assert.equal(init.method, "POST"); assert.deepEqual(JSON.parse(init.body), { tripId: "trip-1" }); return { status: 200, json: async () => ({ data: { endedAt: "2030-01-01T09:00:00.000Z" }, error: null }) }; }, "https://booking.test", "tenant-1", "trip-1");
  assert.deepEqual(state, { kind: "success", endedAt: "2030-01-01T09:00:00.000Z" });
});

test("maps a denied trip stop to safe staff copy", async () => {
  const state = await endFleetTrip(async () => ({ status: 403, json: async () => ({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "internal" } }) }), "https://booking.test", "tenant-1", "trip-1");
  assert.deepEqual(state, { kind: "denied", message: "You do not have access to these live vehicle locations." });
});

test("maps stream snapshots and closes the source", () => {
  const listeners = new Map<string, (event: { data: string }) => void>(); let closed = false; let changed = 0;
  const close = openFleetStream((url, init) => { assert.match(url, /fleet\/stream$/u); assert.equal(init.withCredentials, true); return { addEventListener: (type, listener) => listeners.set(type, listener), close: () => { closed = true; } }; }, "https://booking.test", "tenant-1", (value) => assert.equal(value[0]?.vehicleLabel, "Vehicle 4"), () => { changed += 1; }, () => { throw new Error("unexpected stream error"); });
  listeners.get("snapshot")?.({ data: JSON.stringify({ type: "snapshot", version: 1, response: { data: [{ vehicleLabel: "Vehicle 4" }], error: null } }) });
  listeners.get("changed")?.({ data: JSON.stringify({ type: "changed", version: 2, response: { data: null, error: null } }) });
  assert.equal(changed, 1); close(); assert.equal(closed, true);
});
