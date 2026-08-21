import assert from "node:assert/strict";
import test from "node:test";
import { createDriverSessionClient, createDriverTelemetryFetcher, createDriverTrackingController, createMemoryTelemetryQueue } from "./index.js";

const sample = (eventId: string) => ({ eventId, capturedAt: "2030-01-01T08:00:00.000Z", latitude: -1.2864, longitude: 36.8172, accuracyMetres: 8, batteryPercent: 82 });

test("does not record telemetry until an assigned session is active", async () => {
  const controller = createDriverTrackingController(createMemoryTelemetryQueue(), async () => "accepted");
  assert.deepEqual(await controller.record(sample("event-1")), { kind: "blocked", reason: "session_inactive" });
});

test("queues ordered positions and removes only accepted uploads", async () => {
  const sent: unknown[] = [];
  const queue = createMemoryTelemetryQueue();
  const controller = createDriverTrackingController(queue, async (position) => { sent.push(position); return "accepted"; });
  controller.start("session-1", 4);
  assert.deepEqual(await controller.record(sample("event-1")), { kind: "queued", sequence: 4, result: "accepted" });
  assert.deepEqual(await controller.record(sample("event-2")), { kind: "queued", sequence: 5, result: "accepted" });
  assert.deepEqual((sent as Array<{ sequence: number }>).map((item) => item.sequence), [4, 5]);
});

test("retains queued positions across network failure and flushes later", async () => {
  let online = false;
  const queue = createMemoryTelemetryQueue();
  const controller = createDriverTrackingController(queue, async () => online ? "accepted" : "retry");
  controller.start("session-1");
  assert.deepEqual(await controller.record(sample("event-1")), { kind: "queued", sequence: 0, result: "retry" });
  assert.equal((await queue.read()).length, 1);
  online = true;
  assert.equal(await controller.flush(), "accepted"); assert.equal((await queue.read()).length, 0);
});

test("stops retrying when the API says the session or credential is blocked", async () => {
  const queue = createMemoryTelemetryQueue();
  const controller = createDriverTrackingController(queue, async () => "blocked");
  controller.start("session-1");
  const result = await controller.record(sample("event-1"));
  assert.equal(result.kind, "queued"); if (result.kind === "queued") assert.equal(result.result, "blocked");
  assert.equal((await queue.read()).length, 1);
});

test("sends only the contract payload and bearer credential", async () => {
  let seenUrl = ""; let seenBody = ""; let seenAuth = "";
  const send = createDriverTelemetryFetcher(async (url, init) => { seenUrl = url; seenBody = init.body; seenAuth = init.headers.authorization; return { status: 202 }; }, "https://booking.test/v1/fleet/telemetry", "opaque-credential");
  const result = await send({ sessionId: "session-1", eventId: "event-1", sequence: 0, capturedAt: "2030-01-01T08:00:00.000Z", latitude: -1.28, longitude: 36.81, accuracyMetres: 7 });
  assert.equal(result, "accepted"); assert.equal(seenUrl, "https://booking.test/v1/fleet/telemetry"); assert.equal(seenAuth, "Bearer opaque-credential"); assert.equal("tenantId" in JSON.parse(seenBody), false); assert.equal("deviceId" in JSON.parse(seenBody), false);
});

test("starts and ends an assigned session without exposing API internals", async () => {
  const calls: string[] = [];
  const client = createDriverSessionClient(async (url, init) => { calls.push(`${init.method} ${url}`); if (url.endsWith("tracking-sessions")) return { status: 201, json: async () => ({ data: { id: "session-1", expiresAt: "2030-01-01T12:00:00.000Z" } }) }; return { status: 200, json: async () => ({ data: { endedAt: "2030-01-01T09:00:00.000Z" } }) }; }, "https://booking.test");
  assert.deepEqual(await client.start("tenant-1", "trip-1", "device-1", 60), { kind: "ready", sessionId: "session-1", expiresAt: "2030-01-01T12:00:00.000Z" });
  assert.deepEqual(await client.end("tenant-1", "session-1"), { kind: "success", endedAt: "2030-01-01T09:00:00.000Z" });
  assert.match(calls[0] ?? "", /POST https:\/\/booking\.test\/v1\/tenants\/tenant-1\/fleet\/tracking-sessions$/u);
  assert.match(calls[1] ?? "", /POST https:\/\/booking\.test\/v1\/tenants\/tenant-1\/fleet\/tracking-sessions\/session-1\/end$/u);
});

test("maps a denied mobile session command to simple recovery copy", async () => {
  const client = createDriverSessionClient(async () => ({ status: 403, json: async () => ({ data: null, error: { code: "FLEET_ACCESS_DENIED" } }) }), "https://booking.test");
  assert.deepEqual(await client.start("tenant-1", "trip-1", "device-1"), { kind: "denied", message: "You cannot control this assigned trip." });
});
