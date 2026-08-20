import test from "node:test";
import assert from "node:assert/strict";
import { coordinatesFromSample, interpolationDurationMs, interpolateTransportPosition } from "./transport-position.js";

test("interpolates only between trusted coordinates", () => {
  assert.deepEqual(interpolateTransportPosition({ latitude: 0, longitude: 0 }, { latitude: 10, longitude: 20 }, 0.5), { latitude: 5, longitude: 10 });
  assert.deepEqual(interpolateTransportPosition({ latitude: 0, longitude: 0 }, { latitude: 10, longitude: 20 }, 2), { latitude: 10, longitude: 20 });
});

test("rejects incomplete or non-finite live samples", () => {
  assert.equal(coordinatesFromSample(null), null);
  assert.equal(coordinatesFromSample({ latitude: null, longitude: 1, capturedAt: null }), null);
  assert.equal(coordinatesFromSample({ latitude: Number.NaN, longitude: 1, capturedAt: null }), null);
});

test("bounds smoothing to a practical sample interval", () => {
  assert.equal(interpolationDurationMs(null, null), 900);
  assert.equal(interpolationDurationMs("2026-08-20T10:00:00.000Z", "2026-08-20T10:00:00.100Z"), 450);
  assert.equal(interpolationDurationMs("2026-08-20T10:00:00.000Z", "2026-08-20T10:00:10.000Z"), 4000);
});
