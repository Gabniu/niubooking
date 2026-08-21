// Ownership: public GTFS-Realtime projection from expiring tenant telemetry.

import { buildGtfsRealtimeAlerts, buildGtfsRealtimeTripUpdates, buildGtfsRealtimeVehiclePositions, occupancyStatusFromSeatLoad, type GtfsRealtimeAlertsFeed, type GtfsRealtimeAlert, type GtfsRealtimeTripUpdatesFeed, type GtfsRealtimeVehiclePositionsFeed } from "@bookingapp/domain";
import { withPublicTransaction, withTenantTransaction } from "./pg-executor.js";
import type { Pool } from "pg";
import type { SqlExecutor } from "./tenant-membership.js";

interface FeedRow { tenant_id: string; feed_version_id: string; version: string; realtime_publication_enabled: boolean; }
interface AgencyRow { timezone: string; }
interface PositionRow {
  entity_public_id: string; vehicle_public_id: string; trip_public_id: string; route_public_id: string;
  captured_at: Date; latitude: number; longitude: number; bearing: number | null; speed_metres_per_second: number | null; capacity_mode?: "seat" | "open"; capacity?: number; reserved_quantity?: number;
}
interface TripUpdateRow { entity_public_id: string; vehicle_public_id: string; trip_public_id: string; route_public_id: string; pattern_id: string; occurrence_starts_at: Date; captured_at: Date; stop_public_id: string; stop_sequence: number; arrival_seconds: number; departure_seconds: number; }
interface ReferenceRow { entity_kind: "route" | "trip" | "stop"; public_id: string; }
interface AlertRow { id: string; header_text: string; description_text: string | null; active_from: Date | null; active_until: Date | null; route_public_ids: string[]; stop_public_ids: string[]; trip_public_ids: string[]; }

function dateInTimezone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

function serviceDateAtSeconds(date: string, seconds: number, timezone: string): Date {
  const year = Number(date.slice(0, 4)); const month = Number(date.slice(4, 6)); const day = Number(date.slice(6));
  const utcProbe = new Date(Date.UTC(year, month - 1, day, 12));
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(utcProbe);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour) % 24, Number(values.minute), Number(values.second));
  return new Date(Date.UTC(year, month - 1, day) - (localAsUtc - utcProbe.getTime()) + seconds * 1000);
}

async function readFeed(executor: SqlExecutor, publicSlug: string): Promise<FeedRow | null> {
  const rows = await executor.query<FeedRow>(
    "SELECT settings.tenant_id, version.id AS feed_version_id, version.version, settings.realtime_publication_enabled FROM gtfs_feed_settings settings JOIN gtfs_feed_versions version ON version.tenant_id = settings.tenant_id AND version.id = settings.active_version_id WHERE settings.public_slug = $1 AND settings.schedule_publication_enabled = true AND settings.realtime_publication_enabled = true AND version.status = 'published' AND version.schedule_object_key IS NOT NULL AND version.schedule_sha256 IS NOT NULL",
    [publicSlug],
  );
  return rows[0] ?? null;
}

async function readPositions(executor: SqlExecutor, tenantId: string, feedVersionId: string, now: Date, scheduleVersion: string): Promise<GtfsRealtimeVehiclePositionsFeed> {
  const [agencyRows, rows, referenceRows] = await Promise.all([
    executor.query<AgencyRow>("SELECT timezone FROM transport_agencies WHERE tenant_id = $1 AND status = 'active' ORDER BY id LIMIT 1", [tenantId]),
      executor.query<PositionRow>(`SELECT 'vp-' || vehicle_map.public_id AS entity_public_id, vehicle_map.public_id AS vehicle_public_id, trip_map.public_id AS trip_public_id, route_map.public_id AS route_public_id, current.captured_at, current.latitude, current.longitude, current.heading_degrees AS bearing, current.speed_metres_per_second, trip.capacity_mode, trip.capacity, trip.reserved_quantity
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
    executor.query<ReferenceRow>("SELECT entity_kind, public_id FROM gtfs_feed_version_entities WHERE tenant_id = $1 AND feed_version_id = $2", [tenantId, feedVersionId]),
  ]);
  const timezone = agencyRows[0]?.timezone ?? "UTC";
  const candidates = rows.map((row) => {
    const occupancyStatus = occupancyStatusFromSeatLoad(row.capacity_mode, row.reserved_quantity, row.capacity);
    return {
    entityPublicId: row.entity_public_id, vehiclePublicId: row.vehicle_public_id, tripPublicId: row.trip_public_id,
    routePublicId: row.route_public_id, startDate: dateInTimezone(now, timezone), latitude: row.latitude, longitude: row.longitude,
    ...(row.bearing === null ? {} : { bearing: row.bearing }), ...(row.speed_metres_per_second === null ? {} : { speedMetresPerSecond: row.speed_metres_per_second }), ...(occupancyStatus ? { occupancyStatus } : {}), capturedAt: new Date(row.captured_at),
    };
  });
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
  return withTenantTransaction(pool, feed.tenant_id, (executor) => readPositions(executor, feed.tenant_id, feed.feed_version_id, now, feed.version));
}

export async function readPublicGtfsTripUpdates(pool: Pool, publicSlug: string, now = new Date()): Promise<GtfsRealtimeTripUpdatesFeed | null> {
  if (!publicSlug.trim()) return null;
  const feed = await withPublicTransaction(pool, (executor) => readFeed(executor, publicSlug));
  if (!feed || !feed.realtime_publication_enabled) return null;
  return withTenantTransaction(pool, feed.tenant_id, async (executor) => {
    const [agencyRows, rows, referenceRows] = await Promise.all([
      executor.query<AgencyRow>("SELECT timezone FROM transport_agencies WHERE tenant_id = $1 AND status = 'active' ORDER BY id LIMIT 1", [feed.tenant_id]),
      executor.query<TripUpdateRow>(`SELECT 'tu-' || trip_map.public_id AS entity_public_id, vehicle_map.public_id AS vehicle_public_id, trip_map.public_id AS trip_public_id, route_map.public_id AS route_public_id, pattern.id AS pattern_id, occurrence.starts_at AS occurrence_starts_at, current.captured_at, stop_map.public_id AS stop_public_id, stop_time.sequence AS stop_sequence, stop_time.arrival_seconds, stop_time.departure_seconds
        FROM fleet_tracking_sessions session
        JOIN transport_trips trip ON trip.tenant_id = session.tenant_id AND trip.id = session.trip_id
        JOIN service_occurrences occurrence ON occurrence.tenant_id = trip.tenant_id AND occurrence.id = trip.occurrence_id
        JOIN transport_trip_patterns pattern ON pattern.tenant_id = trip.tenant_id AND pattern.route_id = trip.route_id AND pattern.route_version = trip.route_version AND pattern.service_id = occurrence.service_id AND pattern.status = 'published'
        JOIN transport_pattern_stop_times stop_time ON stop_time.tenant_id = pattern.tenant_id AND stop_time.pattern_id = pattern.id
        JOIN fleet_current_positions current ON current.tenant_id = session.tenant_id AND current.session_id = session.id
        JOIN gtfs_public_id_mappings trip_map ON trip_map.tenant_id = trip.tenant_id AND trip_map.entity_kind = 'trip' AND trip_map.internal_id = trip.id AND trip_map.retired_at IS NULL
        JOIN gtfs_public_id_mappings route_map ON route_map.tenant_id = trip.tenant_id AND route_map.entity_kind = 'route' AND route_map.internal_id = trip.route_id AND route_map.retired_at IS NULL
        JOIN gtfs_public_id_mappings vehicle_map ON vehicle_map.tenant_id = session.tenant_id AND vehicle_map.entity_kind = 'vehicle' AND vehicle_map.internal_id = session.vehicle_resource_id AND vehicle_map.retired_at IS NULL
        JOIN gtfs_public_id_mappings stop_map ON stop_map.tenant_id = stop_time.tenant_id AND stop_map.entity_kind = 'stop' AND stop_map.internal_id = stop_time.stop_id AND stop_map.retired_at IS NULL
        WHERE session.tenant_id = $1 AND session.status = 'active' AND session.expires_at > $2
        ORDER BY trip_map.public_id, pattern.id, stop_time.sequence`, [feed.tenant_id, now]),
      executor.query<ReferenceRow>("SELECT entity_kind, public_id FROM gtfs_feed_version_entities WHERE tenant_id = $1 AND feed_version_id = $2", [feed.tenant_id, feed.feed_version_id]),
    ]);
    const published = { scheduleVersion: feed.version, routeIds: new Set(referenceRows.filter((row) => row.entity_kind === "route").map((row) => row.public_id)), tripIds: new Set(referenceRows.filter((row) => row.entity_kind === "trip").map((row) => row.public_id)), stopIds: new Set(referenceRows.filter((row) => row.entity_kind === "stop").map((row) => row.public_id)) };
    const timezone = agencyRows[0]?.timezone ?? "UTC";
    const grouped = new Map<string, { patternIds: Set<string>; vehiclePublicId: string; routePublicId: string; startDate: string; capturedAt: Date; stops: TripUpdateRow[] }>();
    for (const row of rows) { const current = grouped.get(row.trip_public_id) ?? { patternIds: new Set<string>(), vehiclePublicId: row.vehicle_public_id, routePublicId: row.route_public_id, startDate: dateInTimezone(new Date(row.occurrence_starts_at), timezone), capturedAt: new Date(row.captured_at), stops: [] }; current.patternIds.add(row.pattern_id); current.stops.push(row); grouped.set(row.trip_public_id, current); }
    const candidates = [...grouped.entries()].flatMap(([tripPublicId, group]) => group.patternIds.size !== 1 ? [] : [{ entityPublicId: `tu-${tripPublicId}`, trip: { tripPublicId, routePublicId: group.routePublicId, startDate: group.startDate, scheduleRelationship: "scheduled" as const }, vehiclePublicId: group.vehiclePublicId, capturedAt: group.capturedAt, stopUpdates: group.stops.map((stop) => ({ stopPublicId: stop.stop_public_id, stopSequence: stop.stop_sequence, arrivalAt: serviceDateAtSeconds(group.startDate, stop.arrival_seconds, timezone), departureAt: serviceDateAtSeconds(group.startDate, stop.departure_seconds, timezone) })) }]);
    return buildGtfsRealtimeTripUpdates({ scheduleVersion: feed.version, generatedAt: now, published, candidates }).feed;
  });
}

export async function readPublicGtfsAlerts(pool: Pool, publicSlug: string, now = new Date()): Promise<GtfsRealtimeAlertsFeed | null> {
  if (!publicSlug.trim()) return null;
  const feed = await withPublicTransaction(pool, (executor) => readFeed(executor, publicSlug));
  if (!feed || !feed.realtime_publication_enabled) return null;
  return withTenantTransaction(pool, feed.tenant_id, async (executor) => {
    const [rows, referenceRows] = await Promise.all([
      executor.query<AlertRow>("SELECT id, header_text, description_text, active_from, active_until, route_public_ids, stop_public_ids, trip_public_ids FROM gtfs_realtime_alerts WHERE tenant_id = $1 AND feed_version_id = $2 AND status = 'published' AND (active_from IS NULL OR active_from <= $3) AND (active_until IS NULL OR active_until > $3) ORDER BY id", [feed.tenant_id, feed.feed_version_id, now]),
      executor.query<ReferenceRow>("SELECT entity_kind, public_id FROM gtfs_feed_version_entities WHERE tenant_id = $1 AND feed_version_id = $2", [feed.tenant_id, feed.feed_version_id]),
    ]);
    const published = { scheduleVersion: feed.version, routeIds: new Set(referenceRows.filter((row) => row.entity_kind === "route").map((row) => row.public_id)), tripIds: new Set(referenceRows.filter((row) => row.entity_kind === "trip").map((row) => row.public_id)), stopIds: new Set(referenceRows.filter((row) => row.entity_kind === "stop").map((row) => row.public_id)) };
    const candidates: GtfsRealtimeAlert[] = rows.map((row) => ({ entityPublicId: row.id, headerText: row.header_text, ...(row.description_text ? { descriptionText: row.description_text } : {}), ...(row.active_from ? { activeFrom: new Date(row.active_from) } : {}), ...(row.active_until ? { activeUntil: new Date(row.active_until) } : {}), ...(row.route_public_ids.length ? { routePublicIds: row.route_public_ids } : {}), ...(row.stop_public_ids.length ? { stopPublicIds: row.stop_public_ids } : {}), ...(row.trip_public_ids.length ? { tripPublicIds: row.trip_public_ids } : {}) }));
    return buildGtfsRealtimeAlerts({ scheduleVersion: feed.version, generatedAt: now, published, candidates }).feed;
  });
}
