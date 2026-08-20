// Ownership: filesystem artifact-store safety tests; object keys cannot escape the configured root.

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { persistGtfsScheduleArtifact } from "./gtfs-artifact-publisher.js";
import { createFileGtfsArtifactStore } from "./gtfs-artifact-store.js";

test("reads immutable artifacts and rejects traversal", async () => {
  const root = await mkdtemp(join(tmpdir(), "booking-gtfs-"));
  try {
    await mkdir(join(root, "gtfs")); await writeFile(join(root, "gtfs", "feed.zip"), Buffer.from([80, 75, 3, 4]));
    const store = createFileGtfsArtifactStore(root);
    assert.deepEqual([...((await store.read("gtfs/feed.zip")) ?? [])], [80, 75, 3, 4]);
    assert.equal(await store.read("gtfs/missing.zip"), null);
    await assert.rejects(() => store.read("../outside.zip"), /outside/iu);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("writes immutable artifacts and returns a content digest", async () => {
  const root = await mkdtemp(join(tmpdir(), "booking-gtfs-write-"));
  try {
    const store = createFileGtfsArtifactStore(root);
    const files = [
      { fileName: "agency.txt", content: "agency_id,agency_name,agency_url,agency_timezone\na,Agency,https://example.test,Africa/Nairobi\n" },
      { fileName: "stops.txt", content: "stop_id,stop_name,stop_lat,stop_lon\ns1,One,0,0\ns2,Two,0,1\n" },
      { fileName: "routes.txt", content: "route_id,agency_id,route_type\nr1,a,3\n" },
      { fileName: "trips.txt", content: "route_id,service_id,trip_id\nr1,svc,t1\n" },
      { fileName: "stop_times.txt", content: "trip_id,arrival_time,departure_time,stop_id,stop_sequence\nt1,08:00:00,08:00:00,s1,1\nt1,08:10:00,08:10:00,s2,2\n" },
      { fileName: "calendar_dates.txt", content: "service_id,date,exception_type\nsvc,20260820,1\n" },
    ] as const;
    const first = await persistGtfsScheduleArtifact(store, { objectKey: "gtfs/version-1.zip", files });
    const replay = await persistGtfsScheduleArtifact(store, { objectKey: "gtfs/version-1.zip", files });
    assert.equal(first.sha256, replay.sha256);
    assert.equal((await store.read("gtfs/version-1.zip"))?.byteLength, first.byteLength);
    await assert.rejects(() => store.write("gtfs/version-1.zip", Uint8Array.from([9])), /immutable/iu);
    await assert.rejects(() => persistGtfsScheduleArtifact(store, { objectKey: "unsafe/version.zip", files }), /key is invalid/iu);
  } finally { await rm(root, { recursive: true, force: true }); }
});
