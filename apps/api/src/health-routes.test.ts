import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "./server.js";

const unauthenticated = () => ({ identity: null, mappedUserId: null, membership: null, requestedTenantId: "tenant-1" });

test("exposes liveness and fail-closed readiness probes", async () => {
  const app = createApiServer({ resolve: unauthenticated });
  assert.equal((await app.inject({ method: "GET", url: "/health/live" })).statusCode, 200);
  const ready = await app.inject({ method: "GET", url: "/health/ready" });
  assert.equal(ready.statusCode, 503);
  assert.equal(ready.json().status, "not_ready");
  await app.close();
});

test("readiness reflects the database health check", async () => {
  const app = createApiServer({ resolve: unauthenticated, health: { check: async () => true } });
  const response = await app.inject({ method: "GET", url: "/health/ready" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ready", service: "booking-api" });
  await app.close();
});
