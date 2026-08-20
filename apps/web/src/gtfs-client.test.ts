// Ownership: GTFS client contract mapping tests.

import assert from "node:assert/strict";
import test from "node:test";
import { fetchGtfsPublication, fetchGtfsValidation } from "./gtfs-client.js";

const status = { organizationId: "tenant-1", publicScheduleUrl: null, publicVehiclePositionsUrl: null, publicTripUpdatesUrl: null, publicAlertsUrl: null, activeSchedule: null, latestCandidate: null, features: [], lastRealtimeObservationAt: null, realtimeState: "disabled" as const };

test("loads typed GTFS publication status with encoded tenant", async () => {
  let url = "";
  const result = await fetchGtfsPublication(async (input) => { url = input; return { status: 200, json: async () => ({ data: status, error: null }) }; }, "https://api.example", "tenant/one");
  assert.equal(result.kind, "ready"); assert.equal(url, "https://api.example/v1/tenants/tenant%2Fone/gtfs/publication");
});

test("maps validation denial to safe copy", async () => {
  const result = await fetchGtfsValidation(async () => ({ status: 403, json: async () => ({ data: null, error: { code: "GTFS_ACCESS_DENIED", message: "internal" } }) }), "", "tenant-1", "feed-1");
  assert.deepEqual(result, { kind: "denied", message: "You do not have access to transit publication settings." });
});
