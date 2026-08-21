// Ownership: NIU Driver application orchestration tests; UI and OS adapters are intentionally absent.

import assert from "node:assert/strict";
import test from "node:test";
import { createDriverMobileController, createMemoryTelemetryQueue, type DriverActiveSession, type DriverActiveSessionStorage } from "./index.js";
import { createNativeAuthSession, type NativeAuthStorage } from "./native-auth.js";

const credential = { accessToken: "native-token", expiresAt: "2030-01-01T00:10:00.000Z" };
const sample = { eventId: "event-1", capturedAt: "2030-01-01T00:01:00.000Z", latitude: -1.2864, longitude: 36.8172, accuracyMetres: 8 };

function controller(telemetryStatus: () => number, active: DriverActiveSession | null = null) {
  const storage: NativeAuthStorage = { async read() { return credential; }, async write() {}, async clear() {} };
  const activeStorage: DriverActiveSessionStorage = { async read() { return active; }, async write(next) { active = next; }, async clear() { active = null; } };
  const auth = createNativeAuthSession(storage, () => Date.parse("2030-01-01T00:00:00.000Z"));
  const queue = createMemoryTelemetryQueue();
  return createDriverMobileController({
    auth,
    queue,
    activeSessionStorage: activeStorage,
    apiBaseUrl: "https://booking.test",
    telemetryEndpoint: "https://booking.test/v1/fleet/telemetry",
    sessionFetcher: async (url) => ({
      status: 200,
      json: async () => url.endsWith("/end") ? { data: { endedAt: "2030-01-01T00:02:00.000Z" } } : { data: { id: "session-1", expiresAt: "2030-01-01T00:10:00.000Z" } },
    }),
    telemetryFetcher: async () => ({ status: telemetryStatus() }),
  });
}

test("restores, starts, records, and stops a complete driver journey", async () => {
  const app = controller(() => 202);
  assert.equal((await app.restore()).phase, "ready");
  assert.deepEqual((await app.start({ tenantId: "tenant-1", tripId: "trip-1", deviceId: "device-1" })).phase, "sharing");
  assert.equal((await app.record(sample)).phase, "sharing");
  assert.equal((await app.stop()).phase, "ready");
  assert.equal((await app.signOut()).phase, "signed_out");
});

test("shows offline state while retaining positions and recovers on flush", async () => {
  let status = 503;
  const app = controller(() => status);
  await app.restore();
  await app.start({ tenantId: "tenant-1", tripId: "trip-1", deviceId: "device-1" });
  const offline = await app.record(sample);
  assert.equal(offline.phase, "offline");
  assert.equal(offline.queuedPositions, 1);
  status = 202;
  const recovered = await app.flush();
  assert.equal(recovered.phase, "sharing");
  assert.equal(recovered.queuedPositions, 0);
});

test("does not allow sign-out to abandon an active server session", async () => {
  const app = controller(() => 202);
  await app.restore();
  await app.start({ tenantId: "tenant-1", tripId: "trip-1", deviceId: "device-1" });
  assert.deepEqual((await app.signOut()).message, "Stop location sharing before signing out.");
  assert.equal((await app.stop()).phase, "ready");
});

test("keeps unauthenticated start recoverable without calling the API", async () => {
  const storage: NativeAuthStorage = { async read() { return null; }, async write() {}, async clear() {} };
  const activeStorage: DriverActiveSessionStorage = { async read() { return null; }, async write() {}, async clear() {} };
  let called = false;
  const app = createDriverMobileController({
    auth: createNativeAuthSession(storage),
    queue: createMemoryTelemetryQueue(),
    activeSessionStorage: activeStorage,
    apiBaseUrl: "https://booking.test",
    telemetryEndpoint: "https://booking.test/v1/fleet/telemetry",
    sessionFetcher: async () => { called = true; return { status: 500, json: async () => ({}) }; },
    telemetryFetcher: async () => ({ status: 202 }),
  });
  await app.restore();
  const result = await app.start({ tenantId: "tenant-1", tripId: "trip-1", deviceId: "device-1" });
  assert.equal(result.phase, "signed_out");
  assert.equal(called, false);
});

test("restores an active session without exposing its session identifier", async () => {
  const app = controller(() => 202, { tenantId: "tenant-1", tripId: "trip-1", sessionId: "session-1", expiresAt: "2099-01-01T00:00:00.000Z" });
  const restored = await app.restore();
  assert.equal(restored.phase, "sharing");
  assert.equal(restored.tripId, "trip-1");
  assert.equal("sessionId" in restored, false);
});
