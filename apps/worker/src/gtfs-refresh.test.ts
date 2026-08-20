// Ownership: bounded GTFS-Realtime refresh cadence and failure-state tests.

import assert from "node:assert/strict";
import test from "node:test";
import { createGtfsRefreshTask } from "./gtfs-refresh.js";

test("refreshes only bounded targets and skips work inside the cadence window", async () => {
  const calls: string[] = [];
  const task = createGtfsRefreshTask({
    intervalMs: 15_000,
    maxTargets: 2,
    listTargets: async (limit) => { assert.equal(limit, 2); return [{ publicSlug: "a" }, { publicSlug: "b" }, { publicSlug: "c" }]; },
    refreshTarget: async (target) => { calls.push(target.publicSlug); return { entityCount: 1 }; },
  });
  const first = await task.tick(new Date("2026-08-20T10:00:00Z"));
  const skipped = await task.tick(new Date("2026-08-20T10:00:10Z"));
  assert.equal(first.status, "healthy"); assert.equal(first.targetCount, 2); assert.equal(first.refreshedCount, 2); assert.deepEqual(calls, ["a", "b"]); assert.equal(skipped.lastRunAt, first.lastRunAt);
});

test("reports degraded health when listing or refreshing a feed fails", async () => {
  const listing = createGtfsRefreshTask({ listTargets: async () => { throw new Error("database unavailable"); }, refreshTarget: async () => ({ entityCount: 0 }) });
  assert.equal((await listing.tick(new Date("2026-08-20T10:00:00Z"))).status, "degraded");
  const refreshing = createGtfsRefreshTask({ listTargets: async () => [{ publicSlug: "broken" }], refreshTarget: async () => { throw new Error("projection unavailable"); } });
  const health = await refreshing.tick(new Date("2026-08-20T10:00:00Z"));
  assert.equal(health.status, "degraded"); assert.equal(health.failedCount, 1); assert.match(health.reason ?? "", /failed/iu);
});
