// Ownership: tenant-scoped GTFS Schedule source projection from transport records.

import { serializeGtfsSchedule, type GtfsScheduleDraft, type GtfsScheduleFeature, type GtfsScheduleFile } from "@bookingapp/domain";
import type { SqlExecutor } from "./tenant-membership.js";

interface FeedRow { version: string; valid_from: string | Date; valid_until: string | Date; default_language: string; enabled_features: readonly string[]; }
interface AgencyRow { id: string; name: string; url: string; timezone: string; language: string | null; }
interface StopRow { id: string; code: string | null; name: string; latitude: number; longitude: number; parent_stop_id: string | null; wheelchair_boarding: "unknown" | "possible" | "not_possible"; }
interface RouteRow { id: string; name: string; mode: "bus" | "matatu" | "shuttle" | "charter"; }
interface ServiceRow { id: string; monday: boolean; tuesday: boolean; wednesday: boolean; thursday: boolean; friday: boolean; saturday: boolean; sunday: boolean; start_date: string | Date; end_date: string | Date; }
interface ExceptionRow { service_id: string; service_date: string | Date; exception_type: "added" | "removed"; }
interface ShapePointRow { shape_id: string; sequence: number; latitude: number; longitude: number; distance: number | null; }
interface PatternRow { id: string; route_id: string; service_id: string; shape_id: string | null; headsign: string | null; direction_id: 0 | 1 | null; block_id: string | null; }
interface StopTimeRow { pattern_id: string; stop_id: string; sequence: number; arrival_seconds: number; departure_seconds: number; pickup_type: 0 | 1 | 2 | 3; drop_off_type: 0 | 1 | 2 | 3; shape_distance: number | null; }
interface FrequencyRow { pattern_id: string; start_seconds: number; end_seconds: number; headway_seconds: number; exact_times: boolean; }
interface MappingRow { entity_kind: string; internal_id: string; public_id: string; }

const featureNames = new Set<GtfsScheduleFeature>(["core", "frequencies", "transfers", "translations", "accessibility", "pathways", "fares_v2", "flex"]);
function dateKey(value: string | Date): string { return String(value).slice(0, 10).replaceAll("-", ""); }
function routeType(mode: RouteRow["mode"]): number { return ({ bus: 3, matatu: 3, shuttle: 3, charter: 3 })[mode]; }

export async function readGtfsScheduleDraft(executor: SqlExecutor, input: { tenantId: string; feedVersionId: string }): Promise<GtfsScheduleDraft | null> {
  const feedRows = await executor.query<FeedRow>("SELECT version.version, version.valid_from, version.valid_until, settings.default_language, settings.enabled_features FROM gtfs_feed_versions version JOIN gtfs_feed_settings settings ON settings.tenant_id = version.tenant_id WHERE version.tenant_id = $1 AND version.id = $2 FOR SHARE", [input.tenantId, input.feedVersionId]);
  const feed = feedRows[0];
  if (!feed) return null;
  const [agencies, stops, routes, services, exceptions, shapes, shapePoints, patterns, stopTimes, frequencies, mappings] = await Promise.all([
    executor.query<AgencyRow>("SELECT id, name, url, timezone, language FROM transport_agencies WHERE tenant_id = $1 AND status = 'active' ORDER BY id", [input.tenantId]),
    executor.query<StopRow>("SELECT id, code, name, latitude, longitude, parent_stop_id, wheelchair_boarding FROM transport_stops WHERE tenant_id = $1 AND status = 'active' ORDER BY id", [input.tenantId]),
    executor.query<RouteRow>("SELECT id, name, mode FROM transport_routes WHERE tenant_id = $1 AND status = 'published' ORDER BY id", [input.tenantId]),
    executor.query<ServiceRow>("SELECT id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date FROM transport_service_calendars WHERE tenant_id = $1 ORDER BY id", [input.tenantId]),
    executor.query<ExceptionRow>("SELECT service_id, service_date, exception_type FROM transport_service_exceptions WHERE tenant_id = $1 ORDER BY service_id, service_date", [input.tenantId]),
    executor.query<{ id: string }>("SELECT id FROM transport_shapes WHERE tenant_id = $1 ORDER BY id", [input.tenantId]),
    executor.query<ShapePointRow>("SELECT shape_id, sequence, latitude, longitude, distance FROM transport_shape_points WHERE tenant_id = $1 ORDER BY shape_id, sequence", [input.tenantId]),
    executor.query<PatternRow>("SELECT id, route_id, service_id, shape_id, headsign, direction_id, block_id FROM transport_trip_patterns WHERE tenant_id = $1 AND status = 'published' ORDER BY id", [input.tenantId]),
    executor.query<StopTimeRow>("SELECT pattern_id, stop_id, sequence, arrival_seconds, departure_seconds, pickup_type, drop_off_type, shape_distance FROM transport_pattern_stop_times WHERE tenant_id = $1 ORDER BY pattern_id, sequence", [input.tenantId]),
    executor.query<FrequencyRow>("SELECT pattern_id, start_seconds, end_seconds, headway_seconds, exact_times FROM transport_frequency_windows WHERE tenant_id = $1 ORDER BY pattern_id, start_seconds", [input.tenantId]),
    executor.query<MappingRow>("SELECT entity_kind, internal_id, public_id FROM gtfs_public_id_mappings WHERE tenant_id = $1 AND retired_at IS NULL", [input.tenantId]),
  ]);
  if (!agencies[0]) throw new Error("Add an active transit agency before generating a Schedule");
  const mapping = new Map(mappings.map((row) => [`${row.entity_kind}:${row.internal_id}`, row.public_id]));
  const publicId = (kind: string, internalId: string): string => {
    const value = mapping.get(`${kind}:${internalId}`);
    if (!value) throw new Error(`Reserve a stable GTFS ID for ${kind} ${internalId} before generating a Schedule`);
    return value;
  };
  const stopTimesByPattern = new Map<string, StopTimeRow[]>();
  for (const row of stopTimes) { const values = stopTimesByPattern.get(row.pattern_id) ?? []; values.push(row); stopTimesByPattern.set(row.pattern_id, values); }
  const frequenciesByPattern = new Map<string, FrequencyRow[]>();
  for (const row of frequencies) { const values = frequenciesByPattern.get(row.pattern_id) ?? []; values.push(row); frequenciesByPattern.set(row.pattern_id, values); }
  const exceptionsByService = new Map<string, Record<string, "added" | "removed">>();
  for (const row of exceptions) { const values = exceptionsByService.get(row.service_id) ?? {}; values[dateKey(row.service_date)] = row.exception_type; exceptionsByService.set(row.service_id, values); }
  const pointsByShape = new Map<string, ShapePointRow[]>();
  for (const row of shapePoints) { const values = pointsByShape.get(row.shape_id) ?? []; values.push(row); pointsByShape.set(row.shape_id, values); }
  const enabledFeatures = feed.enabled_features.map((feature) => { if (!featureNames.has(feature as GtfsScheduleFeature)) throw new Error(`GTFS feature ${feature} is not supported by the exporter`); return feature as GtfsScheduleFeature; });
  const agency = agencies[0];
  const usedRouteIds = new Set(patterns.map((row) => row.route_id));
  const usedServiceIds = new Set(patterns.map((row) => row.service_id));
  const usedShapeIds = new Set(patterns.flatMap((row) => row.shape_id ? [row.shape_id] : []));
  return {
    feedVersion: feed.version, defaultLanguage: feed.default_language, validFrom: dateKey(feed.valid_from), validUntil: dateKey(feed.valid_until), enabledFeatures,
    agencies: agencies.map((row) => ({ publicId: publicId("agency", row.id), name: row.name, url: row.url, timezone: row.timezone, ...(row.language ? { language: row.language } : {}) })),
    stops: stops.map((row) => ({ publicId: publicId("stop", row.id), ...(row.code ? { code: row.code } : {}), name: row.name, latitude: row.latitude, longitude: row.longitude, ...(row.parent_stop_id ? { parentPublicId: publicId("stop", row.parent_stop_id) } : {}), wheelchairBoarding: row.wheelchair_boarding })),
    routes: routes.filter((row) => usedRouteIds.has(row.id)).map((row) => ({ publicId: publicId("route", row.id), agencyPublicId: publicId("agency", agency.id), longName: row.name, routeType: routeType(row.mode) })),
    services: services.filter((row) => usedServiceIds.has(row.id)).map((row) => {
      const exceptions = exceptionsByService.get(row.id);
      const base = { publicId: publicId("service", row.id), startDate: dateKey(row.start_date), endDate: dateKey(row.end_date), weekdays: [row.monday, row.tuesday, row.wednesday, row.thursday, row.friday, row.saturday, row.sunday] as [boolean, boolean, boolean, boolean, boolean, boolean, boolean] };
      return exceptions ? { ...base, exceptions } : base;
    }),
    shapes: shapes.filter((shape) => usedShapeIds.has(shape.id)).map((shape) => ({ publicId: publicId("shape", shape.id), points: (pointsByShape.get(shape.id) ?? []).map((point) => ({ sequence: point.sequence, latitude: point.latitude, longitude: point.longitude, ...(point.distance === null ? {} : { distance: point.distance }) })) })),
    trips: patterns.map((row) => ({ publicId: publicId("trip", row.id), routePublicId: publicId("route", row.route_id), servicePublicId: publicId("service", row.service_id), ...(row.headsign ? { headsign: row.headsign } : {}), ...(row.direction_id === null ? {} : { directionId: row.direction_id }), ...(row.shape_id ? { shapePublicId: publicId("shape", row.shape_id) } : {}), stopTimes: (stopTimesByPattern.get(row.id) ?? []).map((stop) => ({ stopPublicId: publicId("stop", stop.stop_id), sequence: stop.sequence, arrivalSeconds: stop.arrival_seconds, departureSeconds: stop.departure_seconds, pickupType: stop.pickup_type, dropOffType: stop.drop_off_type, ...(stop.shape_distance === null ? {} : { shapeDistance: stop.shape_distance }) })) })),
    frequencies: [...frequenciesByPattern.entries()].filter(([patternId]) => patterns.some((row) => row.id === patternId)).flatMap(([patternId, rows]) => rows.map((row) => ({ tripPublicId: publicId("trip", patternId), startSeconds: row.start_seconds, endSeconds: row.end_seconds, headwaySeconds: row.headway_seconds, exactTimes: row.exact_times }))),
  };
}

export async function readGtfsScheduleFiles(executor: SqlExecutor, input: { tenantId: string; feedVersionId: string }): Promise<readonly GtfsScheduleFile[] | null> {
  const draft = await readGtfsScheduleDraft(executor, input);
  return draft ? serializeGtfsSchedule(draft) : null;
}
