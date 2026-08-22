// Ownership: OsmAnd ingress contract tests. Keep provider parsing deterministic and scope-free.

import assert from "node:assert/strict";
import test from "node:test";
import { parseOsmAndObservation } from "./fleet-osmand.js";

const input = { id: "niu_traccar_v1.tenant.session.secretsecretsecretsecretsecret", timestamp: "1893488400", lat: "-1.28", lon: "36.81", accuracy: "8", speed: "10", bearing: "90", batt: "72" };

test("OsmAnd parsing is deterministic and converts knots to metres per second", () => {
  const first = parseOsmAndObservation(input);
  const second = parseOsmAndObservation(input);
  assert.equal(first.kind, "ready");
  assert.equal(second.kind, "ready");
  if (first.kind !== "ready" || second.kind !== "ready") return;
  assert.equal(first.value.observation.eventId, second.value.observation.eventId);
  assert.equal(Math.round((first.value.observation.speedMetresPerSecond ?? 0) * 1_000), 5_144);
  assert.equal(first.value.observation.batteryPercent, 72);
});

test("OsmAnd parsing fails closed for missing identity or coordinates", () => {
  assert.equal(parseOsmAndObservation({ ...input, id: "" }).kind, "invalid");
  assert.equal(parseOsmAndObservation({ ...input, lon: "not-a-coordinate" }).kind, "invalid");
  assert.equal(parseOsmAndObservation({ ...input, valid: "0" }).kind, "invalid");
});
