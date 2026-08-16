import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerCounters, recordBatch, workerHealth } from "./worker-health.js";

test("reports not-ready when no providers are configured", () => {
  const health = workerHealth([], createWorkerCounters());
  assert.equal(health.status, "not_ready");
});

test("records batch counters without exposing payloads", () => {
  const counters = createWorkerCounters();
  recordBatch(counters, { claimed: 3, sent: 2, failed: 1, suppressed: 0 }, new Date("2026-08-12T12:00:00Z"));
  const health = workerHealth(["email"], counters, new Date("2026-08-12T12:01:00Z"));
  assert.equal(health.status, "ready");
  assert.deepEqual(health.counters, { claimed: 3, sent: 2, failed: 1, suppressed: 0, lastBatchAt: new Date("2026-08-12T12:00:00Z") });
});

test("reports degraded when the worker is stale", () => {
  const counters = createWorkerCounters();
  recordBatch(counters, { claimed: 1, sent: 1, failed: 0, suppressed: 0 }, new Date("2026-08-12T12:00:00Z"));
  assert.equal(workerHealth(["sms"], counters, new Date("2026-08-12T12:10:00Z")).status, "degraded");
});
