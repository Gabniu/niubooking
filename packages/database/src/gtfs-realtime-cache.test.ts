// Ownership: durable GTFS-Realtime cache persistence and freshness tests.

import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { readCachedGtfsTripUpdates, readCachedGtfsVehiclePositions, writeCachedGtfsTripUpdates, writeCachedGtfsVehiclePositions } from "./gtfs-realtime-cache.js";

test("reads only a fresh cache tied to the active public Schedule", async () => {
  const client = {
    async query(sql: string) {
      if (sql.includes("SELECT cache.schedule_version")) return { rows: [{ schedule_version: "feed-1", payload: Buffer.from([1, 2]), payload_sha256: "a".repeat(64), generated_at: new Date("2026-08-20T08:01:00Z"), last_observation_at: new Date("2026-08-20T08:00:55Z"), entity_count: 1 }] };
      return { rows: [] };
    }, release() { return undefined; },
  };
  const pool = { async connect() { return client; } } as unknown as Pool;
  const cache = await readCachedGtfsVehiclePositions(pool, "city-feed", new Date("2026-08-20T08:01:10Z"));
  assert.deepEqual([...cache!.payload], [1, 2]); assert.equal(cache?.scheduleVersion, "feed-1"); assert.equal(cache?.entityCount, 1);
});

test("reads and writes a TripUpdates cache using the active Schedule", async () => {
  const statements: string[] = [];
  const client = { async query(sql: string) { statements.push(sql); if (sql.includes("SELECT cache.schedule_version")) return { rows: [{ schedule_version: "feed-1", payload: Buffer.from([3]), payload_sha256: "b".repeat(64), generated_at: new Date("2026-08-20T08:01:00Z"), entity_count: 1 }] }; if (sql.includes("SELECT settings.tenant_id")) return { rows: [{ tenant_id: "tenant-1" }] }; return { rows: [] }; }, release() { return undefined; } };
  const pool = { async connect() { return client; } } as unknown as Pool;
  const cache = await readCachedGtfsTripUpdates(pool, "city-feed", new Date("2026-08-20T08:01:10Z"));
  assert.deepEqual([...cache!.payload], [3]);
  assert.equal(await writeCachedGtfsTripUpdates(pool, { publicSlug: "city-feed", scheduleVersion: "feed-1", payload: Uint8Array.from([3]), sha256: "b".repeat(64), generatedAt: new Date("2026-08-20T08:01:00Z"), entityCount: 1 }), true);
  assert.ok(statements.some((sql) => sql.startsWith("INSERT INTO gtfs_realtime_trip_update_cache")));
});

test("writes a cache only when the public feed still points at that Schedule", async () => {
  const statements: string[] = [];
  const client = {
    async query(sql: string) { statements.push(sql); if (sql.includes("SELECT settings.tenant_id")) return { rows: [{ tenant_id: "tenant-1" }] }; return { rows: [] }; },
    release() { return undefined; },
  };
  const pool = { async connect() { return client; } } as unknown as Pool;
  const written = await writeCachedGtfsVehiclePositions(pool, { publicSlug: "city-feed", scheduleVersion: "feed-1", payload: Uint8Array.from([1, 2]), sha256: "a".repeat(64), generatedAt: new Date("2026-08-20T08:01:00Z"), lastObservationAt: null, entityCount: 0 });
  assert.equal(written, true); assert.ok(statements.some((sql) => sql.startsWith("INSERT INTO gtfs_realtime_vehicle_position_cache")));
});
