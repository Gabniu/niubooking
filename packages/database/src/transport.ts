// Ownership: tenant-scoped transport route/trip persistence layered on occurrences.

import { validateTransportPassengerReservationDraft, validateTransportRouteDraft, validateTransportTripDraft, type TransportPassengerReservation, type TransportPassengerReservationDraft, type TransportRoute, type TransportRouteDraft, type TransportTrip, type TransportTripDraft } from "@bookingapp/domain";
import type { SqlExecutor } from "./tenant-membership.js";
import { withTenantTransaction } from "./pg-executor.js";
import type { Pool } from "pg";

interface RouteRow { id: string; tenant_id: string; version: number; name: string; mode: TransportRoute["mode"]; status: TransportRoute["status"]; stops: readonly StopRow[]; }
interface StopRow { stop_id: string; sequence: number; boarding_minutes: number; alighting_minutes: number; }
interface TripRow { id: string; tenant_id: string; route_id: string; route_version: number; occurrence_id: string; capacity_mode: TransportTrip["capacityMode"]; capacity: number; reserved_quantity?: number; boarding_starts_at: Date; boarding_ends_at: Date; vehicle_resource_id: string | null; }
interface PassengerReservationRow { id: string; tenant_id: string; trip_id: string; occurrence_id: string; customer_id: string; origin_stop_id: string; destination_stop_id: string; quantity: number; status: TransportPassengerReservation["status"]; create_idempotency_key: string | null; }
interface OccurrenceWindow { id: string; tenant_id: string; starts_at: Date; ends_at: Date; }

function mapRoute(row: RouteRow): TransportRoute {
  return { id: row.id, tenantId: row.tenant_id, version: row.version, name: row.name, mode: row.mode, status: row.status, stops: row.stops.map((stop) => ({ stopId: stop.stop_id, sequence: stop.sequence, boardingMinutes: stop.boarding_minutes, alightingMinutes: stop.alighting_minutes })) };
}

function mapTrip(row: TripRow): TransportTrip {
  return { id: row.id, tenantId: row.tenant_id, routeId: row.route_id, routeVersion: row.route_version, occurrenceId: row.occurrence_id, capacityMode: row.capacity_mode, capacity: row.capacity, boardingStartsAt: new Date(row.boarding_starts_at), boardingEndsAt: new Date(row.boarding_ends_at), vehicleResourceId: row.vehicle_resource_id, ...(row.reserved_quantity !== undefined ? { reservedQuantity: row.reserved_quantity } : {}) };
}
function mapPassengerReservation(row: PassengerReservationRow): TransportPassengerReservation { return { id: row.id, tenantId: row.tenant_id, tripId: row.trip_id, occurrenceId: row.occurrence_id, customerId: row.customer_id, originStopId: row.origin_stop_id, destinationStopId: row.destination_stop_id, quantity: row.quantity, status: row.status, ...(row.create_idempotency_key ? { createIdempotencyKey: row.create_idempotency_key } : {}) }; }

const routeColumns = "id, tenant_id, version, name, mode, status";
const tripColumns = "id, tenant_id, route_id, route_version, occurrence_id, capacity_mode, capacity, reserved_quantity, boarding_starts_at, boarding_ends_at, vehicle_resource_id";
const passengerReservationColumns = "tr.reservation_id AS id, tr.tenant_id, tr.trip_id, sr.occurrence_id, sr.customer_id, tr.origin_stop_id, tr.destination_stop_id, tr.quantity, sr.status, tr.create_idempotency_key";

export async function listTransportRoutes(executor: SqlExecutor, tenantId: string): Promise<readonly TransportRoute[]> {
  const rows = await executor.query<RouteRow>(`SELECT r.${routeColumns.replaceAll(", ", ", r.")}, COALESCE(jsonb_agg(jsonb_build_object('stop_id', s.stop_id, 'sequence', s.sequence, 'boarding_minutes', s.boarding_minutes, 'alighting_minutes', s.alighting_minutes) ORDER BY s.sequence) FILTER (WHERE s.stop_id IS NOT NULL), '[]'::jsonb) AS stops FROM transport_routes r LEFT JOIN transport_route_stops s ON s.tenant_id = r.tenant_id AND s.route_id = r.id AND s.route_version = r.version WHERE r.tenant_id = $1 GROUP BY r.id, r.tenant_id, r.version, r.name, r.mode, r.status ORDER BY r.name, r.version DESC`, [tenantId]);
  return rows.map(mapRoute);
}

export async function createTransportRoute(executor: SqlExecutor, draft: TransportRouteDraft): Promise<TransportRoute> {
  const errors = validateTransportRouteDraft(draft);
  if (errors.length) throw new Error(errors.join("; "));
  const routeRows = await executor.query<RouteRow>(`INSERT INTO transport_routes (id, tenant_id, version, name, mode, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${routeColumns}`, [draft.id, draft.tenantId, draft.version, draft.name.trim(), draft.mode, draft.status ?? "draft"]);
  if (!routeRows[0]) throw new Error("Route creation returned no row");
  for (const stop of draft.stops) await executor.query("INSERT INTO transport_route_stops (tenant_id, route_id, route_version, stop_id, sequence, boarding_minutes, alighting_minutes) VALUES ($1,$2,$3,$4,$5,$6,$7)", [draft.tenantId, draft.id, draft.version, stop.stopId, stop.sequence, stop.boardingMinutes, stop.alightingMinutes]);
  return mapRoute({ ...routeRows[0], stops: draft.stops.map((stop) => ({ stop_id: stop.stopId, sequence: stop.sequence, boarding_minutes: stop.boardingMinutes, alighting_minutes: stop.alightingMinutes })) });
}

export async function createTransportTrip(executor: SqlExecutor, draft: TransportTripDraft): Promise<TransportTrip> {
  const routeRows = await executor.query<{ id: string; tenant_id: string; version: number }>("SELECT id, tenant_id, version FROM transport_routes WHERE tenant_id = $1 AND id = $2 AND version = $3 LIMIT 1", [draft.tenantId, draft.routeId, draft.routeVersion]);
  const occurrenceRows = await executor.query<OccurrenceWindow>("SELECT id, tenant_id, starts_at, ends_at FROM service_occurrences WHERE tenant_id = $1 AND id = $2 LIMIT 1", [draft.tenantId, draft.occurrenceId]);
  const route = routeRows[0];
  const occurrence = occurrenceRows[0];
  if (!route || !occurrence) throw new Error("Trip route or occurrence was not found");
  const errors = validateTransportTripDraft(draft, { id: route.id, tenantId: route.tenant_id, version: route.version }, { id: occurrence.id, tenantId: occurrence.tenant_id, startsAt: occurrence.starts_at, endsAt: occurrence.ends_at });
  if (errors.length) throw new Error(errors.join("; "));
  const rows = await executor.query<TripRow>(`INSERT INTO transport_trips (id, tenant_id, route_id, route_version, occurrence_id, capacity_mode, capacity, boarding_starts_at, boarding_ends_at, vehicle_resource_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${tripColumns}`, [draft.id, draft.tenantId, draft.routeId, draft.routeVersion, draft.occurrenceId, draft.capacityMode, draft.capacity, draft.boardingStartsAt, draft.boardingEndsAt, draft.vehicleResourceId ?? null]);
  if (!rows[0]) throw new Error("Trip creation returned no row");
  return mapTrip(rows[0]);
}

export async function listTransportTrips(executor: SqlExecutor, tenantId: string, from?: Date, to?: Date): Promise<readonly TransportTrip[]> {
  const rows = await executor.query<TripRow>(`SELECT ${tripColumns} FROM transport_trips WHERE tenant_id = $1 AND ($2::timestamptz IS NULL OR boarding_ends_at > $2) AND ($3::timestamptz IS NULL OR boarding_starts_at < $3) ORDER BY boarding_starts_at, id`, [tenantId, from ?? null, to ?? null]);
  return rows.map(mapTrip);
}

export async function createTransportPassengerReservation(executor: SqlExecutor, draft: TransportPassengerReservationDraft): Promise<TransportPassengerReservation> {
  if (draft.createIdempotencyKey) await executor.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${draft.tenantId}:${draft.createIdempotencyKey}`]);
  if (draft.createIdempotencyKey) {
    const existing = await executor.query<PassengerReservationRow>(`SELECT ${passengerReservationColumns} FROM transport_trip_reservations tr JOIN service_reservations sr ON sr.tenant_id = tr.tenant_id AND sr.id = tr.reservation_id WHERE tr.tenant_id = $1 AND tr.create_idempotency_key = $2 LIMIT 1`, [draft.tenantId, draft.createIdempotencyKey]);
    if (existing[0]) return mapPassengerReservation(existing[0]);
  }
  const tripRows = await executor.query<TripRow>(`SELECT ${tripColumns} FROM transport_trips WHERE tenant_id = $1 AND id = $2 FOR UPDATE`, [draft.tenantId, draft.tripId]);
  const trip = tripRows[0];
  if (!trip) throw new Error("Trip was not found");
  const stopRows = await executor.query<StopRow>("SELECT stop_id, sequence, boarding_minutes, alighting_minutes FROM transport_route_stops WHERE tenant_id = $1 AND route_id = $2 AND route_version = $3 ORDER BY sequence", [draft.tenantId, trip.route_id, trip.route_version]);
  const errors = validateTransportPassengerReservationDraft(draft, mapTrip(trip), stopRows.map((stop) => ({ stopId: stop.stop_id, sequence: stop.sequence, boardingMinutes: stop.boarding_minutes, alightingMinutes: stop.alighting_minutes })));
  if (errors.length) throw new Error(errors.join("; "));
  const updatedTrip = await executor.query<TripRow>(`UPDATE transport_trips SET reserved_quantity = reserved_quantity + $3, updated_at = now() WHERE tenant_id = $1 AND id = $2 AND reserved_quantity + $3 <= capacity RETURNING ${tripColumns}`, [draft.tenantId, draft.tripId, draft.quantity]);
  if (!updatedTrip[0]) throw new Error("Trip capacity is unavailable");
  const updatedOccurrence = await executor.query("UPDATE service_occurrences SET reserved_quantity = reserved_quantity + $3, updated_at = now() WHERE tenant_id = $1 AND id = $2 AND status IN ('published', 'open') AND (capacity IS NULL OR reserved_quantity + $3 <= capacity) RETURNING id", [draft.tenantId, draft.occurrenceId, draft.quantity]);
  if (!updatedOccurrence[0]) throw new Error("Occurrence capacity is unavailable");
  const reservationRows = await executor.query<PassengerReservationRow>("INSERT INTO service_reservations (id, tenant_id, occurrence_id, customer_id, quantity, status, create_idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, tenant_id, occurrence_id, customer_id, quantity, status, create_idempotency_key", [draft.id, draft.tenantId, draft.occurrenceId, draft.customerId, draft.quantity, draft.status ?? "confirmed", draft.createIdempotencyKey ?? null]);
  if (!reservationRows[0]) throw new Error("Passenger reservation could not be created");
  await executor.query("INSERT INTO transport_trip_reservations (tenant_id, trip_id, reservation_id, origin_stop_id, destination_stop_id, quantity, create_idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7)", [draft.tenantId, draft.tripId, draft.id, draft.originStopId, draft.destinationStopId, draft.quantity, draft.createIdempotencyKey ?? null]);
  return mapPassengerReservation({ ...reservationRows[0], trip_id: draft.tripId, origin_stop_id: draft.originStopId, destination_stop_id: draft.destinationStopId, quantity: draft.quantity, create_idempotency_key: draft.createIdempotencyKey ?? null });
}

export async function listTransportPassengerReservations(executor: SqlExecutor, tenantId: string, tripId: string): Promise<readonly TransportPassengerReservation[]> {
  const rows = await executor.query<PassengerReservationRow>(`SELECT ${passengerReservationColumns} FROM transport_trip_reservations tr JOIN service_reservations sr ON sr.tenant_id = tr.tenant_id AND sr.id = tr.reservation_id WHERE tr.tenant_id = $1 AND tr.trip_id = $2 ORDER BY tr.created_at, tr.reservation_id`, [tenantId, tripId]);
  return rows.map(mapPassengerReservation);
}

export function createDatabaseTransportAdmin(pool: Pool) {
  return { listRoutes: (tenantId: string) => withTenantTransaction(pool, tenantId, (executor) => listTransportRoutes(executor, tenantId)), createRoute: (draft: TransportRouteDraft) => withTenantTransaction(pool, draft.tenantId, (executor) => createTransportRoute(executor, draft)), listTrips: (tenantId: string, from?: Date, to?: Date) => withTenantTransaction(pool, tenantId, (executor) => listTransportTrips(executor, tenantId, from, to)), createTrip: (draft: TransportTripDraft) => withTenantTransaction(pool, draft.tenantId, (executor) => createTransportTrip(executor, draft)), listReservations: (tenantId: string, tripId: string) => withTenantTransaction(pool, tenantId, (executor) => listTransportPassengerReservations(executor, tenantId, tripId)), createReservation: (draft: TransportPassengerReservationDraft) => withTenantTransaction(pool, draft.tenantId, (executor) => createTransportPassengerReservation(executor, draft)) };
}
