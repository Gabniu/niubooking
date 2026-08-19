// Ownership: deterministic fan-out proof; persistence and transport remain replaceable.

import assert from "node:assert/strict";
import test from "node:test";
import { createFleetLiveStream } from "./fleet-live-stream.js";

test("publishes only to listeners subscribed to the changed tenant", () => {
  const stream = createFleetLiveStream(); const received: string[] = [];
  const event = { type: "changed" as const, version: 1, response: { data: null, error: null } };
  const removeA = stream.subscribe("tenant-a", () => { received.push("a"); }); stream.subscribe("tenant-b", () => { received.push("b"); });
  stream.publish("tenant-a", event); assert.deepEqual(received, ["a"]); removeA(); stream.publish("tenant-a", event); assert.deepEqual(received, ["a"]);
});
