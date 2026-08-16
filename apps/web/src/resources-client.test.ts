import assert from "node:assert/strict";
import test from "node:test";
import { fetchResourceAvailability, fetchResources } from "./resources-client.js";

test("loads tenant resources through the typed client", async () => {
  const result = await fetchResources(async (url) => { assert.match(url, /tenant-1\/resources/); return { status: 200, json: async () => ({ data: [{ id: "room-1" }], error: null }) }; }, "", "tenant-1");
  assert.equal(result.kind, "ready");
  if (result.kind === "ready") assert.equal(result.resources[0]?.id, "room-1");
});
test("loads tenant advisory availability through the typed client", async () => {
  const state = await fetchResourceAvailability(async (url) => { assert.match(url, /availability\?/); return { status: 200, json: async () => ({ data: [{ startsAt: "2026-08-14T09:00:00.000Z", endsAt: "2026-08-14T09:30:00.000Z", resourceIds: ["room-1"] }], error: null }) }; }, "", "tenant-1", { from: "2026-08-14T09:00:00.000Z", to: "2026-08-14T10:00:00.000Z", durationMinutes: 30 });
  assert.equal(state.kind, "ready");
  assert.equal(state.slots[0]?.resourceIds[0], "room-1");
});
