// Ownership: tenant-scoped transport route/trip persistence layered on occurrences.

import { isCapacityReserving, validateReservationStatusChange, validateTransportPassengerReservationDraft, validateTransportRouteDraft, validateTransportTicketDraft, validateTransportTripDraft, type PublicTransportTicket, type PublicTransportTrip, type ReservationStatus, type TransportBoarding, type TransportManifestEntry, type TransportPassengerReservation, type TransportPassengerReservationDraft, type TransportRoute, type TransportRouteDraft, type TransportTicket, type TransportTrip, type TransportTripDraft } from "@bookingapp/domain";
import { createHash, createHmac, randomUUID } from "node:crypto";
import type { SqlExecutor } from "./tenant-membership.js";
import { createPoolExecutor, withTenantTransaction } from "./pg-executor.js";
import type { Pool } from "pg";
import { appendAuditEvent } from "./audit-events.js";
import { readQrDestination } from "./qr-destinations.js";
import { createCustomerProfile } from "./customer-profiles.js";
import { upsertCustomerContactMethod } from "./customer-contact-methods.js";

interface RouteRow { id: string; tenant_id: string; version: number; name: string; mode: TransportRoute["mode"]; status: TransportRoute["status"]; stops: readonly StopRow[]; }
interface StopRow { stop_id: string; sequence: number; boarding_minutes: number; alighting_minutes: number; }
interface TripRow { id: string; tenant_id: string; route_id: string; route_version: number; occurrence_id: string; capacity_mode: TransportTrip["capacityMode"]; capacity: number; reserved_quantity?: number; boarding_starts_at: Date; boarding_ends_at: Date; vehicle_resource_id: string | null; }
interface PassengerReservationRow { id: string; tenant_id: string; trip_id: string; occurrence_id: string; customer_id: string; origin_stop_id: string; destination_stop_id: string; quantity: number; status: TransportPassengerReservation["status"]; create_idempotency_key: string | null; }
interface TicketRow { id: string; tenant_id: string; trip_id: string; reservation_id: string; ticket_token_hash: string; fare_amount_minor: number; fare_currency: string; status: TransportTicket["status"]; issued_at: Date; cancelled_at: Date | null; }
interface PublicTicketRow { route_name: string; mode: PublicTransportTicket["mode"]; origin_stop_id: string; destination_stop_id: string; quantity: number; reservation_status: ReservationStatus; status: TransportTicket["status"]; fare_amount_minor: number; fare_currency: string; issued_at: Date; boarding_starts_at: Date; boarding_ends_at: Date; }
interface PublicTripRow { id: string; route_name: string; mode: PublicTransportTrip["mode"]; stops: readonly StopRow[]; capacity_mode: PublicTransportTrip["capacityMode"]; capacity: number; reserved_quantity: number; boarding_starts_at: Date; boarding_ends_at: Date; }
interface BoardingRow { id: string; tenant_id: string; trip_id: string; reservation_id: string; ticket_id: string; actor_id: string | null; action: "boarded"; idempotency_key: string; boarded_at: Date; }
interface OccurrenceWindow { id: string; tenant_id: string; starts_at: Date; ends_at: Date; }

function mapRoute(row: RouteRow): TransportRoute {
  return { id: row.id, tenantId: row.tenant_id, version: row.version, name: row.name, mode: row.mode, status: row.status, stops: row.stops.map((stop) => ({ stopId: stop.stop_id, sequence: stop.sequence, boardingMinutes: stop.boarding_minutes, alightingMinutes: stop.alighting_minutes })) };
}

function mapTrip(row: TripRow): TransportTrip {
  return { id: row.id, tenantId: row.tenant_id, routeId: row.route_id, routeVersion: row.route_version, occurrenceId: row.occurrence_id, capacityMode: row.capacity_mode, capacity: row.capacity, boardingStartsAt: new Date(row.boarding_starts_at), boardingEndsAt: new Date(row.boarding_ends_at), vehicleResourceId: row.vehicle_resource_id, ...(row.reserved_quantity !== undefined ? { reservedQuantity: row.reserved_quantity } : {}) };
}
function mapPassengerReservation(row: PassengerReservationRow): TransportPassengerReservation { return { id: row.id, tenantId: row.tenant_id, tripId: row.trip_id, occurrenceId: row.occurrence_id, customerId: row.customer_id, originStopId: row.origin_stop_id, destinationStopId: row.destination_stop_id, quantity: row.quantity, status: row.status, ...(row.create_idempotency_key ? { createIdempotencyKey: row.create_idempotency_key } : {}) }; }
function tokenFor(secret: string, tenantId: string, ticketId: string): string { return createHmac("sha256", secret).update(`${tenantId}:${ticketId}`).digest("base64url"); }
function tokenHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
function mapTicket(row: TicketRow, secret: string, includeToken = false): TransportTicket { const ticketToken = tokenFor(secret, row.tenant_id, row.id); return { id: row.id, tenantId: row.tenant_id, tripId: row.trip_id, reservationId: row.reservation_id, fareAmountMinor: row.fare_amount_minor, fareCurrency: row.fare_currency, status: row.status, issuedAt: new Date(row.issued_at), ...(includeToken ? { ticketToken } : {}) }; }

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

export async function setTransportPassengerReservationStatus(executor: SqlExecutor, input: { tenantId: string; tripId: string; reservationId: string; status: ReservationStatus; actorId?: string }): Promise<TransportPassengerReservation> {
  const rows = await executor.query<PassengerReservationRow>(`SELECT ${passengerReservationColumns} FROM transport_trip_reservations tr JOIN service_reservations sr ON sr.tenant_id = tr.tenant_id AND sr.id = tr.reservation_id WHERE tr.tenant_id = $1 AND tr.trip_id = $2 AND tr.reservation_id = $3 FOR UPDATE`, [input.tenantId, input.tripId, input.reservationId]);
  const current = rows[0];
  if (!current) throw new Error("Passenger reservation was not found");
  const errors = validateReservationStatusChange(current.status, input.status);
  if (errors.length) throw new Error(errors.join("; "));
  if (current.status !== input.status && isCapacityReserving(current.status) !== isCapacityReserving(input.status)) {
    const direction = isCapacityReserving(input.status) ? "reserve" : "release";
    const tripUpdate = direction === "reserve"
      ? await executor.query("UPDATE transport_trips SET reserved_quantity = reserved_quantity + $3, updated_at = now() WHERE tenant_id = $1 AND id = $2 AND reserved_quantity + $3 <= capacity RETURNING id", [input.tenantId, input.tripId, current.quantity])
      : await executor.query("UPDATE transport_trips SET reserved_quantity = reserved_quantity - $3, updated_at = now() WHERE tenant_id = $1 AND id = $2 AND reserved_quantity >= $3 RETURNING id", [input.tenantId, input.tripId, current.quantity]);
    if (!tripUpdate[0]) throw new Error(direction === "reserve" ? "Trip capacity is unavailable" : "Trip inventory is inconsistent");
    const occurrenceUpdate = direction === "reserve"
      ? await executor.query("UPDATE service_occurrences SET reserved_quantity = reserved_quantity + $3, updated_at = now() WHERE tenant_id = $1 AND id = $2 AND status IN ('published', 'open') AND (capacity IS NULL OR reserved_quantity + $3 <= capacity) RETURNING id", [input.tenantId, current.occurrence_id, current.quantity])
      : await executor.query("UPDATE service_occurrences SET reserved_quantity = reserved_quantity - $3, updated_at = now() WHERE tenant_id = $1 AND id = $2 AND reserved_quantity >= $3 RETURNING id", [input.tenantId, current.occurrence_id, current.quantity]);
    if (!occurrenceUpdate[0]) throw new Error(direction === "reserve" ? "Occurrence capacity is unavailable" : "Occurrence inventory is inconsistent");
  }
  const updated = await executor.query<PassengerReservationRow>("UPDATE service_reservations SET status = $4, updated_at = now() WHERE tenant_id = $1 AND occurrence_id = $2 AND id = $3 RETURNING id, tenant_id, occurrence_id, customer_id, quantity, status, create_idempotency_key", [input.tenantId, current.occurrence_id, input.reservationId, input.status]);
  if (!updated[0]) throw new Error("Passenger reservation status could not be updated");
  if (current.status !== input.status) await appendAuditEvent(executor, { tenantId: input.tenantId, actorType: input.actorId ? "user" : "system", actorId: input.actorId ?? null, action: "reservation.status_changed", entityType: "reservation", entityId: input.reservationId, metadata: { trip_id: input.tripId, from_status: current.status, to_status: input.status, quantity: current.quantity } });
  return mapPassengerReservation({ ...updated[0], trip_id: input.tripId, origin_stop_id: current.origin_stop_id, destination_stop_id: current.destination_stop_id, quantity: current.quantity, create_idempotency_key: current.create_idempotency_key });
}

export async function createTransportTicket(executor: SqlExecutor, draft: Pick<TransportTicket, "id" | "tenantId" | "tripId" | "reservationId" | "fareAmountMinor" | "fareCurrency">, secret: string): Promise<TransportTicket> {
  const errors = validateTransportTicketDraft(draft);
  if (errors.length) throw new Error(errors.join("; "));
  if (!secret) throw new Error("Ticket signing is not configured");
  const reservationRows = await executor.query<PassengerReservationRow>(`SELECT ${passengerReservationColumns} FROM transport_trip_reservations tr JOIN service_reservations sr ON sr.tenant_id = tr.tenant_id AND sr.id = tr.reservation_id WHERE tr.tenant_id = $1 AND tr.trip_id = $2 AND tr.reservation_id = $3 FOR UPDATE`, [draft.tenantId, draft.tripId, draft.reservationId]);
  const reservation = reservationRows[0];
  if (!reservation) throw new Error("Passenger reservation was not found");
  if (!["held", "confirmed"].includes(reservation.status)) throw new Error("Only an active passenger reservation can receive a ticket");
  const existing = await executor.query<TicketRow>("SELECT id, tenant_id, trip_id, reservation_id, ticket_token_hash, fare_amount_minor, fare_currency, status, issued_at, cancelled_at FROM transport_tickets WHERE tenant_id = $1 AND reservation_id = $2 LIMIT 1", [draft.tenantId, draft.reservationId]);
  if (existing[0]) return mapTicket(existing[0], secret, true);
  const token = tokenFor(secret, draft.tenantId, draft.id);
  const rows = await executor.query<TicketRow>("INSERT INTO transport_tickets (id, tenant_id, trip_id, reservation_id, ticket_token_hash, fare_amount_minor, fare_currency) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, tenant_id, trip_id, reservation_id, ticket_token_hash, fare_amount_minor, fare_currency, status, issued_at, cancelled_at", [draft.id, draft.tenantId, draft.tripId, draft.reservationId, tokenHash(token), draft.fareAmountMinor, draft.fareCurrency]);
  if (!rows[0]) throw new Error("Ticket could not be issued");
  return mapTicket(rows[0], secret, true);
}

export async function listTransportManifest(executor: SqlExecutor, tenantId: string, tripId: string, secret: string): Promise<readonly TransportManifestEntry[]> {
  const reservations = await listTransportPassengerReservations(executor, tenantId, tripId);
  const tickets = await executor.query<TicketRow>("SELECT id, tenant_id, trip_id, reservation_id, ticket_token_hash, fare_amount_minor, fare_currency, status, issued_at, cancelled_at FROM transport_tickets WHERE tenant_id = $1 AND trip_id = $2 ORDER BY issued_at, id", [tenantId, tripId]);
  const ticketByReservation = new Map(tickets.map((ticket) => [ticket.reservation_id, mapTicket(ticket, secret)]));
  return reservations.map((reservation) => ({ reservation, ticket: ticketByReservation.get(reservation.id) ?? null }));
}

function mapPublicTrip(row: PublicTripRow): PublicTransportTrip { return { id: row.id, routeName: row.route_name, mode: row.mode, stops: row.stops.map((stop) => ({ stopId: stop.stop_id, sequence: stop.sequence, boardingMinutes: stop.boarding_minutes, alightingMinutes: stop.alighting_minutes })), capacityMode: row.capacity_mode, capacity: row.capacity, remainingCapacity: Math.max(0, row.capacity - row.reserved_quantity), boardingStartsAt: new Date(row.boarding_starts_at), boardingEndsAt: new Date(row.boarding_ends_at) }; }
function mapBoarding(row: BoardingRow): TransportBoarding { return { id: row.id, tenantId: row.tenant_id, tripId: row.trip_id, reservationId: row.reservation_id, ticketId: row.ticket_id, actorId: row.actor_id, action: row.action, idempotencyKey: row.idempotency_key, boardedAt: new Date(row.boarded_at) }; }

export async function listPublicTransportTrips(executor: SqlExecutor, tenantId: string, publicCode: string, from?: Date, to?: Date): Promise<readonly PublicTransportTrip[]> {
  const destination = await readQrDestination(executor, publicCode);
  if (!destination || destination.tenantId !== tenantId || destination.status !== "active" || (destination.expiresAt && destination.expiresAt <= new Date())) throw new Error("QR destination is unavailable");
  const rows = await executor.query<PublicTripRow>(`SELECT trip.id, route.name AS route_name, route.mode, trip.capacity_mode, trip.capacity, trip.reserved_quantity, trip.boarding_starts_at, trip.boarding_ends_at, COALESCE(jsonb_agg(jsonb_build_object('stop_id', stops.stop_id, 'sequence', stops.sequence, 'boarding_minutes', stops.boarding_minutes, 'alighting_minutes', stops.alighting_minutes) ORDER BY stops.sequence), '[]'::jsonb) AS stops FROM transport_trips trip JOIN transport_routes route ON route.tenant_id = trip.tenant_id AND route.id = trip.route_id AND route.version = trip.route_version JOIN service_occurrences occurrence ON occurrence.tenant_id = trip.tenant_id AND occurrence.id = trip.occurrence_id LEFT JOIN transport_route_stops stops ON stops.tenant_id = trip.tenant_id AND stops.route_id = trip.route_id AND stops.route_version = trip.route_version WHERE trip.tenant_id = $1 AND route.status = 'published' AND occurrence.status IN ('published', 'open') AND ($2::timestamptz IS NULL OR trip.boarding_ends_at > $2) AND ($3::timestamptz IS NULL OR trip.boarding_starts_at < $3) AND ($4::text IS NULL OR occurrence.service_id = $4) GROUP BY trip.id, route.name, route.mode, trip.capacity_mode, trip.capacity, trip.reserved_quantity, trip.boarding_starts_at, trip.boarding_ends_at ORDER BY trip.boarding_starts_at, trip.id`, [tenantId, from ?? null, to ?? null, destination.serviceId]);
  return rows.map(mapPublicTrip);
}

export interface PublicTransportReservationInput { tenantId: string; publicCode: string; tripId: string; customerName: string; originStopId: string; destinationStopId: string; quantity: number; idempotencyKey: string; contact?: { channel: import("@bookingapp/domain").CommunicationChannel; destination: string; consentGranted: boolean }; }

export async function createPublicTransportPassengerReservation(executor: SqlExecutor, input: PublicTransportReservationInput): Promise<TransportPassengerReservation> {
  await executor.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${input.tenantId}:${input.idempotencyKey}`]);
  const existing = await executor.query<PassengerReservationRow>(`SELECT ${passengerReservationColumns} FROM transport_trip_reservations tr JOIN service_reservations sr ON sr.tenant_id = tr.tenant_id AND sr.id = tr.reservation_id WHERE tr.tenant_id = $1 AND tr.create_idempotency_key = $2 LIMIT 1`, [input.tenantId, input.idempotencyKey]);
  if (existing[0]) return mapPassengerReservation(existing[0]);
  const destination = await readQrDestination(executor, input.publicCode);
  if (!destination || destination.tenantId !== input.tenantId || destination.status !== "active" || (destination.expiresAt && destination.expiresAt <= new Date())) throw new Error("QR destination is unavailable");
  const tripRows = await executor.query<TripRow>("SELECT trip.id, trip.tenant_id, trip.route_id, trip.route_version, trip.occurrence_id, trip.capacity_mode, trip.capacity, trip.reserved_quantity, trip.boarding_starts_at, trip.boarding_ends_at, trip.vehicle_resource_id FROM transport_trips trip JOIN transport_routes route ON route.tenant_id = trip.tenant_id AND route.id = trip.route_id AND route.version = trip.route_version JOIN service_occurrences occurrence ON occurrence.tenant_id = trip.tenant_id AND occurrence.id = trip.occurrence_id WHERE trip.tenant_id = $1 AND trip.id = $2 AND route.status = 'published' AND occurrence.status IN ('published', 'open') AND ($3::text IS NULL OR occurrence.service_id = $3) LIMIT 1", [input.tenantId, input.tripId, destination.serviceId]);
  const trip = tripRows[0];
  if (!trip) throw new Error("Trip is unavailable from this booking link");
  const customer = await createCustomerProfile(executor, { id: randomUUID(), tenantId: input.tenantId, displayName: input.customerName });
  const reservation = await createTransportPassengerReservation(executor, { id: randomUUID(), tenantId: input.tenantId, tripId: input.tripId, occurrenceId: trip.occurrence_id, customerId: customer.id, originStopId: input.originStopId, destinationStopId: input.destinationStopId, quantity: input.quantity, createIdempotencyKey: input.idempotencyKey, status: "confirmed" });
  if (input.contact) await upsertCustomerContactMethod(executor, { id: randomUUID(), tenantId: input.tenantId, customerId: customer.id, channel: input.contact.channel, destination: input.contact.destination, consentStatus: input.contact.consentGranted ? "granted" : "denied", verifiedAt: null });
  return reservation;
}

export async function readPublicTransportTicket(executor: SqlExecutor, token: string, secret: string): Promise<PublicTransportTicket | null> {
  if (!token || !secret) return null;
  const rows = await executor.query<PublicTicketRow>(`SELECT r.name AS route_name, r.mode, tr.origin_stop_id, tr.destination_stop_id, tr.quantity, sr.status AS reservation_status, tt.status, tt.fare_amount_minor, tt.fare_currency, tt.issued_at, trip.boarding_starts_at, trip.boarding_ends_at FROM transport_tickets tt JOIN transport_trip_reservations tr ON tr.tenant_id = tt.tenant_id AND tr.reservation_id = tt.reservation_id AND tr.trip_id = tt.trip_id JOIN service_reservations sr ON sr.tenant_id = tr.tenant_id AND sr.id = tr.reservation_id JOIN transport_trips trip ON trip.tenant_id = tt.tenant_id AND trip.id = tt.trip_id JOIN transport_routes r ON r.tenant_id = trip.tenant_id AND r.id = trip.route_id AND r.version = trip.route_version WHERE tt.ticket_token_hash = $1 LIMIT 1`, [tokenHash(token)]);
  const row = rows[0];
  if (!row) return null;
  return { routeName: row.route_name, mode: row.mode, originStopId: row.origin_stop_id, destinationStopId: row.destination_stop_id, quantity: row.quantity, reservationStatus: row.reservation_status, status: row.status, fareAmountMinor: row.fare_amount_minor, fareCurrency: row.fare_currency, issuedAt: new Date(row.issued_at), boardingStartsAt: new Date(row.boarding_starts_at), boardingEndsAt: new Date(row.boarding_ends_at) };
}

export async function boardTransportTicket(executor: SqlExecutor, input: { id: string; tenantId: string; tripId: string; ticketId: string; idempotencyKey: string; actorId?: string }): Promise<TransportBoarding> {
  if (!input.id || !input.tenantId || !input.tripId || !input.ticketId || input.idempotencyKey.trim().length < 8 || input.idempotencyKey.trim().length > 200) throw new Error("Boarding identity and retry key are required");
  await executor.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${input.tenantId}:${input.idempotencyKey}`]);
  const replay = await executor.query<BoardingRow>("SELECT id, tenant_id, trip_id, reservation_id, ticket_id, actor_id, action, idempotency_key, boarded_at FROM transport_boardings WHERE tenant_id = $1 AND idempotency_key = $2 LIMIT 1", [input.tenantId, input.idempotencyKey]);
  if (replay[0]) return mapBoarding(replay[0]);
  const rows = await executor.query<{ reservation_id: string; status: TransportTicket["status"]; reservation_status: ReservationStatus }>("SELECT ticket.reservation_id, ticket.status, reservation.status AS reservation_status FROM transport_tickets ticket JOIN service_reservations reservation ON reservation.tenant_id = ticket.tenant_id AND reservation.id = ticket.reservation_id WHERE ticket.tenant_id = $1 AND ticket.trip_id = $2 AND ticket.id = $3 FOR UPDATE", [input.tenantId, input.tripId, input.ticketId]);
  const ticket = rows[0];
  if (!ticket) throw new Error("Ticket was not found for this trip");
  if (ticket.status !== "issued") throw new Error("Only an issued ticket can be boarded");
  if (ticket.reservation_status !== "confirmed") throw new Error("This reservation is not ready for boarding");
  const inserted = await executor.query<BoardingRow>("INSERT INTO transport_boardings (id, tenant_id, trip_id, reservation_id, ticket_id, actor_id, idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, tenant_id, trip_id, reservation_id, ticket_id, actor_id, action, idempotency_key, boarded_at", [input.id, input.tenantId, input.tripId, ticket.reservation_id, input.ticketId, input.actorId ?? null, input.idempotencyKey]);
  if (!inserted[0]) throw new Error("Boarding could not be recorded");
  const checkedIn = await executor.query("UPDATE service_reservations SET status = 'checked_in', updated_at = now() WHERE tenant_id = $1 AND id = $2 AND status = 'confirmed' RETURNING id", [input.tenantId, ticket.reservation_id]);
  if (!checkedIn[0]) throw new Error("Reservation could not be checked in");
  await appendAuditEvent(executor, { tenantId: input.tenantId, actorType: input.actorId ? "user" : "system", actorId: input.actorId ?? null, action: "transport.boarded", entityType: "reservation", entityId: ticket.reservation_id, metadata: { trip_id: input.tripId, ticket_id: input.ticketId, boarding_id: input.id } });
  return mapBoarding(inserted[0]);
}

export function createDatabaseTransportAdmin(pool: Pool, ticketSecret = "") {
  return { listRoutes: (tenantId: string) => withTenantTransaction(pool, tenantId, (executor) => listTransportRoutes(executor, tenantId)), createRoute: (draft: TransportRouteDraft) => withTenantTransaction(pool, draft.tenantId, (executor) => createTransportRoute(executor, draft)), listTrips: (tenantId: string, from?: Date, to?: Date) => withTenantTransaction(pool, tenantId, (executor) => listTransportTrips(executor, tenantId, from, to)), createTrip: (draft: TransportTripDraft) => withTenantTransaction(pool, draft.tenantId, (executor) => createTransportTrip(executor, draft)), listReservations: (tenantId: string, tripId: string) => withTenantTransaction(pool, tenantId, (executor) => listTransportPassengerReservations(executor, tenantId, tripId)), createReservation: (draft: TransportPassengerReservationDraft) => withTenantTransaction(pool, draft.tenantId, (executor) => createTransportPassengerReservation(executor, draft)), setReservationStatus: (input: { tenantId: string; tripId: string; reservationId: string; status: ReservationStatus; actorId?: string }) => withTenantTransaction(pool, input.tenantId, (executor) => setTransportPassengerReservationStatus(executor, input)), createTicket: (draft: Pick<TransportTicket, "id" | "tenantId" | "tripId" | "reservationId" | "fareAmountMinor" | "fareCurrency">) => withTenantTransaction(pool, draft.tenantId, (executor) => createTransportTicket(executor, draft, ticketSecret)), listManifest: (tenantId: string, tripId: string) => withTenantTransaction(pool, tenantId, (executor) => listTransportManifest(executor, tenantId, tripId, ticketSecret)), boardTicket: (input: { id: string; tenantId: string; tripId: string; ticketId: string; idempotencyKey: string; actorId?: string }) => withTenantTransaction(pool, input.tenantId, (executor) => boardTransportTicket(executor, input)), discoverPublicTrips: (input: { tenantId: string; publicCode: string; from?: Date; to?: Date }) => withTenantTransaction(pool, input.tenantId, (executor) => listPublicTransportTrips(executor, input.tenantId, input.publicCode, input.from, input.to)), reservePublic: (input: PublicTransportReservationInput) => withTenantTransaction(pool, input.tenantId, (executor) => createPublicTransportPassengerReservation(executor, input)), readPublicTicket: (token: string) => readPublicTransportTicket(createPoolExecutor(pool), token, ticketSecret) };
}
