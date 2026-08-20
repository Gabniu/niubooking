// Ownership: GTFS source projection tests; transport rows must become stable Schedule IDs.

import assert from "node:assert/strict";
import test from "node:test";
import { readGtfsScheduleDraft, readGtfsScheduleFiles } from "./gtfs-source.js";

const mapping = [
  { entity_kind: "agency", internal_id: "agency-1", public_id: "agency-public" },
  { entity_kind: "stop", internal_id: "stop-1", public_id: "stop-one" },
  { entity_kind: "stop", internal_id: "stop-2", public_id: "stop-two" },
  { entity_kind: "route", internal_id: "route-1", public_id: "route-public" },
  { entity_kind: "service", internal_id: "service-1", public_id: "service-public" },
  { entity_kind: "trip", internal_id: "pattern-1", public_id: "trip-public" },
  { entity_kind: "shape", internal_id: "shape-1", public_id: "shape-public" },
];

function executor(withMapping = mapping) {
  return { query: async <T>(sql: string): Promise<T[]> => {
    if (sql.startsWith("SELECT version.version")) return [{ version: "2026.08", valid_from: "2026-08-20", valid_until: "2026-12-31", default_language: "en", enabled_features: ["core", "frequencies"] }] as T[];
    if (sql.includes("FROM transport_agencies")) return [{ id: "agency-1", name: "Niu Transit", url: "https://transit.example", timezone: "Africa/Nairobi", language: "en" }] as T[];
    if (sql.includes("FROM transport_stops")) return [{ id: "stop-1", code: "ONE", name: "One", latitude: -1, longitude: 36, parent_stop_id: null, wheelchair_boarding: "possible" }, { id: "stop-2", code: "TWO", name: "Two", latitude: -1.1, longitude: 36.1, parent_stop_id: null, wheelchair_boarding: "unknown" }] as T[];
    if (sql.includes("FROM transport_routes")) return [{ id: "route-1", name: "City Loop", mode: "matatu" }] as T[];
    if (sql.includes("FROM transport_service_calendars")) return [{ id: "service-1", monday: true, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false, start_date: "2026-08-20", end_date: "2026-12-31" }] as T[];
    if (sql.includes("FROM transport_service_exceptions")) return [{ service_id: "service-1", service_date: "2026-08-21", exception_type: "added" }] as T[];
    if (sql.includes("SELECT id FROM transport_shapes")) return [{ id: "shape-1" }] as T[];
    if (sql.includes("FROM transport_shape_points")) return [{ shape_id: "shape-1", sequence: 1, latitude: -1, longitude: 36, distance: 0 }, { shape_id: "shape-1", sequence: 2, latitude: -1.1, longitude: 36.1, distance: 10 }] as T[];
    if (sql.includes("FROM transport_trip_patterns")) return [{ id: "pattern-1", route_id: "route-1", service_id: "service-1", shape_id: "shape-1", headsign: "Two", direction_id: 0, block_id: null }] as T[];
    if (sql.includes("FROM transport_pattern_stop_times")) return [{ pattern_id: "pattern-1", stop_id: "stop-1", sequence: 1, arrival_seconds: 28800, departure_seconds: 28800, pickup_type: 0, drop_off_type: 0, shape_distance: 0 }, { pattern_id: "pattern-1", stop_id: "stop-2", sequence: 2, arrival_seconds: 29400, departure_seconds: 29400, pickup_type: 0, drop_off_type: 0, shape_distance: 10 }] as T[];
    if (sql.includes("FROM transport_frequency_windows")) return [{ pattern_id: "pattern-1", start_seconds: 28800, end_seconds: 32400, headway_seconds: 900, exact_times: false }] as T[];
    if (sql.includes("FROM gtfs_public_id_mappings")) return withMapping as T[];
    throw new Error(`Unexpected SQL: ${sql}`);
  } };
}

test("projects published transport records into a stable GTFS draft and files", async () => {
  const draft = await readGtfsScheduleDraft(executor(), { tenantId: "tenant-1", feedVersionId: "feed-1" });
  assert.equal(draft?.routes[0]?.publicId, "route-public");
  assert.equal(draft?.services[0]?.exceptions?.["20260821"], "added");
  const files = await readGtfsScheduleFiles(executor(), { tenantId: "tenant-1", feedVersionId: "feed-1" });
  assert.deepEqual(files?.map(({ fileName }) => fileName).sort(), ["agency.txt", "calendar.txt", "calendar_dates.txt", "frequencies.txt", "routes.txt", "shapes.txt", "stop_times.txt", "stops.txt", "trips.txt"]);
});

test("refuses to invent a public ID when source data is not mapped", async () => {
  await assert.rejects(() => readGtfsScheduleDraft(executor(mapping.filter((row) => row.entity_kind !== "route")), { tenantId: "tenant-1", feedVersionId: "feed-1" }), /stable GTFS ID/iu);
});
