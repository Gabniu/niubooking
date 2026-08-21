// Ownership: database projection tests for public GTFS-Realtime VehiclePositions.

import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { readPublicGtfsAlerts, readPublicGtfsTripUpdates, readPublicGtfsVehiclePositions } from "./gtfs-realtime.js";

test("publishes only fresh positions with references present in the Schedule source", async () => {
  const client = {
    async query(sql: string) {
      if (sql.includes("SELECT settings.tenant_id")) return { rows: [{ tenant_id: "tenant-1", feed_version_id: "version-1", version: "feed-1", realtime_publication_enabled: true }] };
      if (sql.includes("SELECT timezone")) return { rows: [{ timezone: "Africa/Nairobi" }] };
      if (sql.includes("FROM fleet_tracking_sessions")) return { rows: [
        { entity_public_id: "vp-v1", vehicle_public_id: "v1", trip_public_id: "trip-1", route_public_id: "route-1", captured_at: new Date("2026-08-20T08:01:00Z"), latitude: -1.28, longitude: 36.82, bearing: null, speed_metres_per_second: null },
        { entity_public_id: "vp-v2", vehicle_public_id: "v2", trip_public_id: "private-trip", route_public_id: "route-1", captured_at: new Date("2026-08-20T08:01:00Z"), latitude: -1.28, longitude: 36.82, bearing: null, speed_metres_per_second: null },
      ] };
      if (sql.includes("FROM gtfs_feed_version_entities")) return { rows: [
        { entity_kind: "route", public_id: "route-1" }, { entity_kind: "trip", public_id: "trip-1" },
      ] };
      return { rows: [] };
    },
    release() { return undefined; },
  };
  const pool = { async connect() { return client; } } as unknown as Pool;
  const feed = await readPublicGtfsVehiclePositions(pool, "city-feed", new Date("2026-08-20T08:01:30Z"));
  assert.deepEqual(feed?.entities.map((entity) => entity.entityPublicId), ["vp-v1"]);
  assert.equal("deviceId" in (feed?.entities[0] ?? {}), false);
});

test("projects TripUpdates only from one published pattern with persisted stop-times", async () => {
  const client = {
    async query(sql: string) {
      if (sql.includes("SELECT settings.tenant_id")) return { rows: [{ tenant_id: "tenant-1", feed_version_id: "version-1", version: "feed-1", realtime_publication_enabled: true }] };
      if (sql.includes("SELECT timezone")) return { rows: [{ timezone: "Africa/Nairobi" }] };
      if (sql.includes("FROM fleet_tracking_sessions")) return { rows: [{ entity_public_id: "tu-trip-1", vehicle_public_id: "v1", trip_public_id: "trip-1", route_public_id: "route-1", pattern_id: "pattern-1", occurrence_starts_at: new Date("2026-08-20T05:00:00Z"), captured_at: new Date("2026-08-20T08:01:00Z"), stop_public_id: "stop-1", stop_sequence: 1, arrival_seconds: 8 * 3600, departure_seconds: 8 * 3600 + 30 }] };
      if (sql.includes("FROM gtfs_feed_version_entities")) return { rows: [{ entity_kind: "route", public_id: "route-1" }, { entity_kind: "trip", public_id: "trip-1" }, { entity_kind: "stop", public_id: "stop-1" }] };
      return { rows: [] };
    }, release() { return undefined; },
  };
  const pool = { async connect() { return client; } } as unknown as Pool;
  const feed = await readPublicGtfsTripUpdates(pool, "city-feed", new Date("2026-08-20T08:01:30Z"));
  assert.equal(feed?.entities[0]?.trip.tripPublicId, "trip-1"); assert.equal(feed?.entities[0]?.stopUpdates[0]?.stopPublicId, "stop-1");
});

test("publishes only active, Schedule-referenced Alerts", async () => {
  const client = {
    async query(sql: string) {
      if (sql.includes("SELECT settings.tenant_id")) return { rows: [{ tenant_id: "tenant-1", feed_version_id: "version-1", version: "feed-1", realtime_publication_enabled: true }] };
      if (sql.includes("FROM gtfs_realtime_alerts")) return { rows: [{ id: "alert-1", header_text: "Road closed", description_text: null, active_from: null, active_until: null, route_public_ids: ["route-1"], stop_public_ids: [], trip_public_ids: [] }] };
      if (sql.includes("FROM gtfs_feed_version_entities")) return { rows: [{ entity_kind: "route", public_id: "route-1" }] };
      return { rows: [] };
    }, release() { return undefined; },
  };
  const pool = { async connect() { return client; } } as unknown as Pool;
  const feed = await readPublicGtfsAlerts(pool, "city-feed", new Date("2026-08-21T10:00:00Z"));
  assert.deepEqual(feed?.entities.map((alert) => alert.entityPublicId), ["alert-1"]);
});
