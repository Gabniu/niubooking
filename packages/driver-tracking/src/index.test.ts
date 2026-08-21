import assert from "node:assert/strict";
import test from "node:test";
import { createDriverTelemetryFetcher, createDriverTrackingController, createMemoryTelemetryQueue } from "./index.js";

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
