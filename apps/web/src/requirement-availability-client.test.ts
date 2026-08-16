import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchRequirementAvailability } from "./requirement-availability-client.js";

test("loads advisory requirement slots with an optional variant", async () => {
  const state = await fetchRequirementAvailability(async (url) => ({ status: 200, json: async () => ({ data: { slots: [], rejected: [] }, error: null }), url } as never), "", "tenant-1", "service-1", { from: "2026-08-14T09:00:00Z", to: "2026-08-14T10:00:00Z", durationMinutes: 30, stepMinutes: 30, variantId: "variant-1" });
  assert.equal(state.kind, "ready");
});
