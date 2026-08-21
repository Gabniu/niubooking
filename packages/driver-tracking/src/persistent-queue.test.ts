// Ownership: durable telemetry queue contract tests; location records must survive app restarts.

import assert from "node:assert/strict";
import test from "node:test";
import { createPersistentTelemetryQueue, type DriverTelemetryQueueStorage } from "./persistent-queue.js";
import type { DriverPositionUpload } from "@bookingapp/contracts";

const position: DriverPositionUpload = {
  sessionId: "session-1", eventId: "event-1", sequence: 0,
  capturedAt: "2030-01-01T08:00:00.000Z", latitude: -1.2864, longitude: 36.8172, accuracyMetres: 8,
};

function storage(initial: readonly DriverPositionUpload[] = []): DriverTelemetryQueueStorage & { values: DriverPositionUpload[] } {
  const state = { values: initial.slice() };
  return {
    get values() { return state.values; },
    async read() { return state.values.slice(); },
    async write(values) { state.values = values.slice(); },
  };
}

test("rehydrates queued telemetry after an app restart", async () => {
  const persisted = storage();
  const first = createPersistentTelemetryQueue(persisted);
  await first.append(position);
  const restarted = createPersistentTelemetryQueue(persisted);
  assert.deepEqual(await restarted.read(), [position]);
});

test("serializes concurrent append and remove operations without dropping records", async () => {
  const persisted = storage();
  const queue = createPersistentTelemetryQueue(persisted);
  await Promise.all([
    queue.append(position),
    queue.append({ ...position, eventId: "event-2", sequence: 1 }),
  ]);
  assert.deepEqual((await queue.read()).map((item) => item.eventId), ["event-1", "event-2"]);
  await queue.removeFirst();
  assert.deepEqual((await queue.read()).map((item) => item.eventId), ["event-2"]);
});

test("fails closed when persisted telemetry is malformed", async () => {
  const persisted = storage([{ ...position, latitude: Number.NaN }]);
  const queue = createPersistentTelemetryQueue(persisted);
  await assert.rejects(() => queue.read(), /Stored telemetry queue is invalid/u);
});
