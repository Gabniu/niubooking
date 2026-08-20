// Ownership: public GTFS-Realtime projection from expiring tenant telemetry.

import { buildGtfsRealtimeVehiclePositions, type GtfsRealtimeVehiclePositionsFeed } from "@bookingapp/domain";
import { withPublicTransaction, withTenantTransaction } from "./pg-executor.js";
import type { Pool } from "pg";
import type { SqlExecutor } from "./tenant-membership.js";

interface FeedRow { tenant_id: string; version: string; realtime_publication_enabled: boolean; }
interface AgencyRow { timezone: string; }
interface PositionRow {
  entity_public_id: string; vehicle_public_id: string; trip_public_id: string; route_public_id: string;
  captured_at: Date; latitude: number; longitude: number; bearing: number | null; speed_metres_per_second: number | null;
}
interface ReferenceRow { entity_kind: "route" | "trip" | "stop"; public_id: string; }

function dateInTimezone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

async function readFeed(executor: SqlExecutor, publicSlug: string): Promise<FeedRow | null> {
  const rows = await executor.query<FeedRow>(
    "SELECT settings.tenant_id, version.version, settings.realtime_publication_enabled FROM gtfs_feed_settings settings JOIN gtfs_feed_versions version ON version.tenant_id = settings.tenant_id AND version.id = settings.active_version_id WHERE settings.public_slug = $1 AND settings.schedule_publication_enabled = true AND settings.realtime_publication_enabled = true AND version.status = 'published' AND version.schedule_object_key IS NOT NULL AND version.schedule_sha256 IS NOT NULL",
    [publicSlug],
  );
  return rows[0] ?? null;
}

async function readPositions(executor: SqlExecutor, tenantId: string, now: Date, scheduleVersion: string): Promise<GtfsRealtimeVehiclePositionsFeed> {
  const [agencyRows, rows, referenceRows] = await Promise.all([
    executor.query<AgencyRow>("SELECT timezone FROM transport_agencies WHERE tenant_id = $1 AND status = 'active' ORDER BY id LIMIT 1", [tenantId]),
    executor.query<PositionRow>(`SELECT 'vp-' || vehicle_map.public_id AS entity_public_id, vehicle_map.public_id AS vehicle_public_id, trip_map.public_id AS trip_public_id, route_map.public_id AS route_public_id, current.captured_at, current.latitude, current.longitude, current.heading_degrees AS bearing, current.speed_metres_per_second
      FROM fleet_tracking_sessions session
      JOIN transport_trips trip ON trip.tenant_id = session.tenant_id AND trip.id = session.trip_id
      JOIN transport_routes route ON route.tenant_id = trip.tenant_id AND route.id = trip.route_id AND route.version = trip.route_version AND route.status = 'published'
      JOIN booking_resources vehicle ON vehicle.tenant_id = session.tenant_id AND vehicle.id = session.vehicle_resource_id
      JOIN fleet_current_positions current ON current.tenant_id = session.tenant_id AND current.session_id = session.id
      JOIN gtfs_public_id_mappings vehicle_map ON vehicle_map.tenant_id = session.tenant_id AND vehicle_map.entity_kind = 'vehicle' AND vehicle_map.internal_id = vehicle.id AND vehicle_map.retired_at IS NULL
      JOIN gtfs_public_id_mappings trip_map ON trip_map.tenant_id = session.tenant_id AND trip_map.entity_kind = 'trip' AND trip_map.internal_id = trip.id AND trip_map.retired_at IS NULL
      JOIN gtfs_public_id_mappings route_map ON route_map.tenant_id = session.tenant_id AND route_map.entity_kind = 'route' AND route_map.internal_id = route.id AND route_map.retired_at IS NULL
      WHERE session.tenant_id = $1 AND session.status = 'active' AND session.expires_at > $2
      ORDER BY vehicle_map.public_id, trip_map.public_id`, [tenantId, now]),
    executor.query<ReferenceRow>(`SELECT mapping.entity_kind, mapping.public_id FROM gtfs_public_id_mappings mapping
      LEFT JOIN transport_routes route ON route.tenant_id = mapping.tenant_id AND route.id = mapping.internal_id AND mapping.entity_kind = 'route' AND route.status = 'published'
      LEFT JOIN transport_trip_patterns pattern ON pattern.tenant_id = mapping.tenant_id AND pattern.id = mapping.internal_id AND mapping.entity_kind = 'trip' AND pattern.status = 'published'
      LEFT JOIN transport_stops stop ON stop.tenant_id = mapping.tenant_id AND stop.id = mapping.internal_id AND mapping.entity_kind = 'stop' AND stop.status = 'active'
      WHERE mapping.tenant_id = $1 AND mapping.retired_at IS NULL AND (route.id IS NOT NULL OR pattern.id IS NOT NULL OR stop.id IS NOT NULL)`, [tenantId]),
  ]);
  const timezone = agencyRows[0]?.timezone ?? "UTC";
  const candidates = rows.map((row) => ({
    entityPublicId: row.entity_public_id, vehiclePublicId: row.vehicle_public_id, tripPublicId: row.trip_public_id,
    routePublicId: row.route_public_id, startDate: dateInTimezone(now, timezone), latitude: row.latitude, longitude: row.longitude,
    ...(row.bearing === null ? {} : { bearing: row.bearing }), ...(row.speed_metres_per_second === null ? {} : { speedMetresPerSecond: row.speed_metres_per_second }), capturedAt: new Date(row.captured_at),
  }));
  const published = {
    scheduleVersion,
    routeIds: new Set(referenceRows.filter((row) => row.entity_kind === "route").map((row) => row.public_id)),
    tripIds: new Set(referenceRows.filter((row) => row.entity_kind === "trip").map((row) => row.public_id)),
    stopIds: new Set(referenceRows.filter((row) => row.entity_kind === "stop").map((row) => row.public_id)),
  };
  return buildGtfsRealtimeVehiclePositions({ scheduleVersion, generatedAt: now, published, candidates }).feed;
}

export async function readPublicGtfsVehiclePositions(pool: Pool, publicSlug: string, now = new Date()): Promise<GtfsRealtimeVehiclePositionsFeed | null> {
  if (!publicSlug.trim()) return null;
  const feed = await withPublicTransaction(pool, (executor) => readFeed(executor, publicSlug));
  if (!feed || !feed.realtime_publication_enabled) return null;
  return withTenantTransaction(pool, feed.tenant_id, (executor) => readPositions(executor, feed.tenant_id, now, feed.version));
}
