// Ownership: deterministic telemetry validation, ordering, and freshness proof.

import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyPositionFreshness,
  evaluateVehiclePosition,
  type VehiclePosition,
} from "./realtime-telemetry.js";

const capturedAt = new Date("2026-08-19T10:00:00.000Z");

function position(input: Partial<VehiclePosition> = {}): VehiclePosition {
  return {
    eventId: "event-1",
    sessionId: "session-1",
    deviceId: "device-1",
    sequence: 1,
    capturedAt,
    receivedAt: new Date("2026-08-19T10:00:01.000Z"),
    latitude: -1.286389,
    longitude: 36.817223,
    accuracyMetres: 8,
    speedMetresPerSecond: 10,
    headingDegrees: 45,
    batteryPercent: 80,
    ...input,
  };
}

test("accepts the first valid position as current", () => {
  assert.deepEqual(evaluateVehiclePosition(position(), null), {
    decision: "advance_current",
    reasons: [],
  });
});

test("keeps delayed offline replay in history without rewinding current", () => {
  const current = position({ eventId: "event-2", sequence: 2, capturedAt: new Date("2026-08-19T10:00:10Z") });
  const delayed = position({ receivedAt: new Date("2026-08-19T10:00:12Z") });
  assert.equal(evaluateVehiclePosition(delayed, current).decision, "history_only");
});

test("rejects duplicates and another device session", () => {
  const current = position();
  assert.equal(evaluateVehiclePosition(position(), current).decision, "reject");
  assert.match(
    evaluateVehiclePosition(position({ eventId: "event-2", deviceId: "device-2" }), current).reasons[0] ?? "",
    /active device session/iu,
  );
});

test("rejects future, inaccurate, and implausible positions", () => {
  const future = position({ capturedAt: new Date("2026-08-19T10:05:00Z") });
  assert.match(evaluateVehiclePosition(future, null).reasons.join(" "), /future/iu);
  assert.match(evaluateVehiclePosition(position({ accuracyMetres: 900 }), null).reasons.join(" "), /accuracy/iu);
  const current = position();
  const jump = position({
    eventId: "event-2",
    sequence: 2,
    capturedAt: new Date("2026-08-19T10:00:01Z"),
    receivedAt: new Date("2026-08-19T10:00:02Z"),
    latitude: -1.0,
  });
  assert.match(evaluateVehiclePosition(jump, current).reasons.join(" "), /plausible speed/iu);
});

test("classifies freshness at the published boundaries", () => {
  const now = new Date("2026-08-19T10:02:00Z");
  assert.equal(classifyPositionFreshness(new Date("2026-08-19T10:01:45Z"), now), "live");
  assert.equal(classifyPositionFreshness(new Date("2026-08-19T10:01:44Z"), now), "delayed");
  assert.equal(classifyPositionFreshness(new Date("2026-08-19T10:01:14Z"), now), "signal_weak");
  assert.equal(classifyPositionFreshness(new Date("2026-08-19T10:00:29Z"), now), "offline");
  assert.equal(classifyPositionFreshness(now, now, false), "offline");
});
