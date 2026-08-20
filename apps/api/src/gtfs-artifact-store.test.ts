// Ownership: filesystem artifact-store safety tests; object keys cannot escape the configured root.

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
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
