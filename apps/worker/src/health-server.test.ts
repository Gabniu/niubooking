// Ownership: worker probe contract. Keep the deployment-facing health surface small and redacted.

import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createWorkerHealthServer } from "./health-server.js";
import type { WorkerRuntime } from "./worker-runtime.js";
import type { WorkerHealth } from "./worker-health.js";

function runtime(status: "ready" | "not_ready" | "degraded"): WorkerRuntime {
  const health: WorkerHealth = { status, configuredChannels: status === "not_ready" ? [] : ["email"], counters: { claimed: 0, sent: 0, failed: 0, suppressed: 0, lastBatchAt: null }, reason: status === "not_ready" ? "No communication provider is configured." : null };
  return { health: () => health, tick: async () => health };
}

async function withServer<T>(worker: WorkerRuntime, action: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createWorkerHealthServer(worker);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  try { return await action(`http://127.0.0.1:${port}`); } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

test("health server exposes liveness and redacted readiness", async () => {
  await withServer(runtime("ready"), async (baseUrl) => {
    const live = await fetch(`${baseUrl}/health/live`);
    assert.equal(live.status, 200);
    assert.deepEqual(await live.json(), { status: "ok", service: "booking-worker" });
    const ready = await fetch(`${baseUrl}/health/ready`);
    assert.equal(ready.status, 200);
    const body = await ready.json() as Record<string, unknown>;
    assert.equal(body.service, "booking-worker");
    assert.equal(body.status, "ready");
    assert.equal("jobs" in body, false);
  });
});

test("readiness returns 503 until a provider is configured", async () => {
  await withServer(runtime("not_ready"), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health/ready`);
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { status: string }).status, "not_ready");
  });
});
