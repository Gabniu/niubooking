import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { assignTransportReservationSeats, boardTransportTicket, cancelPublicTransportReservation, createPublicTransportPassengerReservation, createTransportPassengerReservation, createTransportRoute, createTransportTicket, createTransportTrip, listPublicTransportTrips, listTransportManifest, listTransportPassengerReservations, listTransportRoutes, listTransportTrips, setTransportPassengerReservationStatus } from "./transport.js";

const routeRow = { id: "route-1", tenant_id: "tenant-1", version: 1, name: "CBD — Westlands", mode: "matatu" as const, status: "draft" as const };
const stops = [{ stop_id: "cbd", sequence: 1, boarding_minutes: 10, alighting_minutes: 0 }, { stop_id: "westlands", sequence: 2, boarding_minutes: 10, alighting_minutes: 10 }];
const tripRow = { id: "trip-1", tenant_id: "tenant-1", route_id: "route-1", route_version: 1, occurrence_id: "occurrence-1", capacity_mode: "open" as const, capacity: 33, boarding_starts_at: new Date("2026-09-01T07:00:00Z"), boarding_ends_at: new Date("2026-09-01T07:30:00Z"), vehicle_resource_id: null };

test("lists tenant routes with ordered stops", async () => {
  const executor = { query: async <T>() => [{ ...routeRow, stops }] as T[] };
  const routes = await listTransportRoutes(executor, "tenant-1");
  assert.equal(routes[0]?.stops[1]?.stopId, "westlands");
});

test("creates a validated route and its stop rows", async () => {
  const statements: string[] = [];
  const executor = { query: async <T>(sql: string) => { statements.push(sql); return (sql.startsWith("INSERT INTO transport_routes") ? [{ ...routeRow }] : []) as T[]; } };
  const route = await createTransportRoute(executor, { ...routeRow, tenantId: "tenant-1", stops: stops.map((stop) => ({ stopId: stop.stop_id, sequence: stop.sequence, boardingMinutes: stop.boarding_minutes, alightingMinutes: stop.alighting_minutes })) });
  assert.equal(route.stops.length, 2);
  assert.equal(statements.filter((statement) => statement.startsWith("INSERT INTO transport_route_stops")).length, 2);
});

test("creates a trip only when its route and occurrence share the tenant", async () => {
  const executor = { query: async <T>(sql: string) => {
    if (sql.includes("FROM transport_routes")) return [{ id: "route-1", tenant_id: "tenant-1", version: 1 }] as T[];
    if (sql.includes("FROM service_occurrences")) return [{ id: "occurrence-1", tenant_id: "tenant-1", starts_at: new Date("2026-09-01T07:00:00Z"), ends_at: new Date("2026-09-01T10:00:00Z") }] as T[];
    return [tripRow] as T[];
  } };
  const trip = await createTransportTrip(executor, { ...tripRow, tenantId: "tenant-1", routeId: "route-1", routeVersion: 1, occurrenceId: "occurrence-1", capacityMode: "open", capacity: 33, boardingStartsAt: tripRow.boarding_starts_at, boardingEndsAt: tripRow.boarding_ends_at });
  assert.equal(trip.routeVersion, 1);
});

test("rejects a trip outside its occurrence window", async () => {
  const executor = { query: async <T>(sql: string) => {
    if (sql.includes("FROM transport_routes")) return [{ id: "route-1", tenant_id: "tenant-1", version: 1 }] as T[];
    if (sql.includes("FROM service_occurrences")) return [{ id: "occurrence-1", tenant_id: "tenant-1", starts_at: new Date("2026-09-01T07:00:00Z"), ends_at: new Date("2026-09-01T10:00:00Z") }] as T[];
    return [] as T[];
  } };
  await assert.rejects(() => createTransportTrip(executor, { ...tripRow, tenantId: "tenant-1", routeId: "route-1", routeVersion: 1, occurrenceId: "occurrence-1", capacityMode: "open", capacity: 33, boardingStartsAt: new Date("2026-09-01T06:00:00Z"), boardingEndsAt: new Date("2026-09-01T07:30:00Z") }), /before/iu);
});

test("lists trips within a boarding window", async () => {
  const executor = { query: async <T>() => [tripRow] as T[] };
  const trips = await listTransportTrips(executor, "tenant-1", new Date("2026-09-01T06:00:00Z"), new Date("2026-09-01T08:00:00Z"));
  assert.equal(trips[0]?.id, "trip-1");
});

test("creates and lists a tenant-safe passenger reservation with trip capacity", async () => {
  const reservationRow = { id: "reservation-1", tenant_id: "tenant-1", occurrence_id: "occurrence-1", customer_id: "customer-1", quantity: 2, status: "confirmed" as const, create_idempotency_key: "retry-123" };
  const statements: string[] = [];
  const executor = { query: async <T>(sql: string) => {
    statements.push(sql);
    if (sql.includes("FROM transport_trips")) return [{ ...tripRow, reserved_quantity: 4 }] as T[];
    if (sql.includes("FROM transport_route_stops")) return stops as T[];
    if (sql.startsWith("UPDATE transport_trips")) return [{ ...tripRow, reserved_quantity: 6 }] as T[];
    if (sql.startsWith("UPDATE service_occurrences")) return [{ id: "occurrence-1" }] as T[];
    if (sql.startsWith("INSERT INTO service_reservations")) return [reservationRow] as T[];
    return [] as T[];
  } };
  const reservation = await createTransportPassengerReservation(executor, { id: "reservation-1", tenantId: "tenant-1", tripId: "trip-1", occurrenceId: "occurrence-1", customerId: "customer-1", originStopId: "cbd", destinationStopId: "westlands", quantity: 2, createIdempotencyKey: "retry-123" });
  assert.equal(reservation.tripId, "trip-1");
  assert.ok(statements.some((statement) => statement.startsWith("INSERT INTO transport_trip_reservations")));
  const listed = await listTransportPassengerReservations({ query: async <T>() => [{ ...reservationRow, trip_id: "trip-1", origin_stop_id: "cbd", destination_stop_id: "westlands" }] as T[] }, "tenant-1", "trip-1");
  assert.equal(listed[0]?.quantity, 2);
});

test("rejects a passenger reservation when the requested stop order is invalid", async () => {
  const executor = { query: async <T>(sql: string) => {
    if (sql.includes("FROM transport_trips")) return [{ ...tripRow, reserved_quantity: 0 }] as T[];
    if (sql.includes("FROM transport_route_stops")) return stops as T[];
    return [] as T[];
  } };
  await assert.rejects(() => createTransportPassengerReservation(executor, { id: "reservation-1", tenantId: "tenant-1", tripId: "trip-1", occurrenceId: "occurrence-1", customerId: "customer-1", originStopId: "westlands", destinationStopId: "cbd", quantity: 1, createIdempotencyKey: "retry-123" }), /come before/iu);
});

test("releases trip and occurrence capacity when a passenger cancels", async () => {
  const current = { id: "reservation-1", tenant_id: "tenant-1", trip_id: "trip-1", occurrence_id: "occurrence-1", customer_id: "customer-1", origin_stop_id: "cbd", destination_stop_id: "westlands", quantity: 2, status: "confirmed" as const, create_idempotency_key: "retry-123" };
  const statements: string[] = [];
  const executor = { query: async <T>(sql: string) => {
    statements.push(sql);
    if (sql.startsWith("SELECT tr.reservation_id")) return [current] as T[];
    if (sql.startsWith("UPDATE transport_trips")) return [{ id: "trip-1" }] as T[];
    if (sql.startsWith("UPDATE service_occurrences")) return [{ id: "occurrence-1" }] as T[];
    if (sql.startsWith("UPDATE service_reservations")) return [{ ...current, status: "cancelled" }] as T[];
    if (sql.startsWith("INSERT INTO audit_events")) return [{ id: "audit-1" }] as T[];
    return [] as T[];
  } };
  const result = await setTransportPassengerReservationStatus(executor, { tenantId: "tenant-1", tripId: "trip-1", reservationId: "reservation-1", status: "cancelled", actorId: "staff-1" });
  assert.equal(result.status, "cancelled");
  assert.ok(statements.some((statement) => statement.startsWith("UPDATE transport_trips SET reserved_quantity = reserved_quantity -")));
  assert.ok(statements.some((statement) => statement.startsWith("UPDATE service_occurrences SET reserved_quantity = reserved_quantity -")));
});

test("assigns unique seats under a trip lock and rejects occupied seats", async () => {
  const current = { id: "reservation-1", tenant_id: "tenant-1", trip_id: "trip-1", occurrence_id: "occurrence-1", customer_id: "customer-1", origin_stop_id: "cbd", destination_stop_id: "westlands", quantity: 2, status: "confirmed" as const, create_idempotency_key: "retry-123", seat_labels: [] as readonly string[] };
  const executor = { query: async <T>(sql: string) => {
    if (sql.startsWith("SELECT capacity_mode")) return [{ capacity_mode: "seat", capacity: 4 }] as T[];
    if (sql.includes("FROM transport_trip_reservations") && sql.includes("FOR UPDATE")) return [current] as T[];
    if (sql.startsWith("SELECT unnest")) return [] as T[];
    if (sql.startsWith("UPDATE transport_trip_reservations")) return [{ seat_labels: ["1", "4"] }] as T[];
    if (sql.startsWith("INSERT INTO audit_events")) return [{ id: "audit-1" }] as T[];
    return [] as T[];
  } };
  const assigned = await assignTransportReservationSeats(executor, { tenantId: "tenant-1", tripId: "trip-1", reservationId: "reservation-1", seatLabels: ["1", "4"], actorId: "staff-1" });
  assert.deepEqual(assigned.seatLabels, ["1", "4"]);

  const conflictExecutor = { query: async <T>(sql: string) => {
    if (sql.startsWith("SELECT capacity_mode")) return [{ capacity_mode: "seat", capacity: 4 }] as T[];
    if (sql.includes("FROM transport_trip_reservations") && sql.includes("FOR UPDATE")) return [current] as T[];
    if (sql.startsWith("SELECT unnest")) return [{ seat_label: "2" }] as T[];
    return [] as T[];
  } };
  await assert.rejects(() => assignTransportReservationSeats(conflictExecutor, { tenantId: "tenant-1", tripId: "trip-1", reservationId: "reservation-1", seatLabels: ["2", "3"] }), /already assigned/iu);
});

test("issues a deterministic opaque ticket and builds a manifest", async () => {
  const current = { id: "reservation-1", tenant_id: "tenant-1", trip_id: "trip-1", occurrence_id: "occurrence-1", customer_id: "customer-1", origin_stop_id: "cbd", destination_stop_id: "westlands", quantity: 2, status: "confirmed" as const, create_idempotency_key: "retry-123" };
  const ticketRow = { id: "ticket-1", tenant_id: "tenant-1", trip_id: "trip-1", reservation_id: "reservation-1", ticket_token_hash: "hash", fare_amount_minor: 2500, fare_currency: "KES", status: "issued" as const, issued_at: new Date("2026-09-01T06:00:00Z"), cancelled_at: null };
  const executor = { query: async <T>(sql: string) => {
    if (sql.includes("FROM transport_trip_reservations") && sql.includes("FOR UPDATE")) return [current] as T[];
    if (sql.startsWith("SELECT id, tenant_id, trip_id, reservation_id, ticket_token_hash") && sql.includes("reservation_id =")) return [] as T[];
    if (sql.startsWith("INSERT INTO transport_tickets")) return [ticketRow] as T[];
    if (sql.includes("FROM transport_trip_reservations") && !sql.includes("FOR UPDATE")) return [current] as T[];
    if (sql.startsWith("SELECT id, tenant_id, trip_id, reservation_id, ticket_token_hash")) return [ticketRow] as T[];
    return [] as T[];
  } };
  const ticket = await createTransportTicket(executor, { id: "ticket-1", tenantId: "tenant-1", tripId: "trip-1", reservationId: "reservation-1", fareAmountMinor: 2500, fareCurrency: "KES" }, "booking-secret");
  assert.ok(ticket.ticketToken);
  const manifest = await listTransportManifest(executor, "tenant-1", "trip-1", "booking-secret");
  assert.equal(manifest[0]?.ticket?.fareCurrency, "KES");
  assert.equal(manifest[0]?.ticket?.ticketToken, undefined);
});

test("reads a public ticket view without internal identities", async () => {
  const token = createHmac("sha256", "booking-secret").update("tenant-1:ticket-1").digest("base64url");
  const executor = { query: async <T>(sql: string) => sql.startsWith("SELECT r.name AS route_name") ? [{ route_name: "CBD — Westlands", mode: "matatu" as const, origin_stop_id: "cbd", destination_stop_id: "westlands", quantity: 2, reservation_status: "confirmed" as const, status: "issued" as const, fare_amount_minor: 2500, fare_currency: "KES", issued_at: new Date("2026-09-01T06:00:00Z"), boarding_starts_at: new Date("2026-09-01T07:00:00Z"), boarding_ends_at: new Date("2026-09-01T07:30:00Z") }] as T[] : [] as T[] };
  const { readPublicTransportTicket } = await import("./transport.js");
  const ticket = await readPublicTransportTicket(executor, token, "booking-secret");
  assert.equal(ticket?.routeName, "CBD — Westlands");
  assert.equal(ticket?.reservationStatus, "confirmed");
});

test("maps assigned seats into a public ticket projection", async () => {
  const token = createHmac("sha256", "booking-secret").update("tenant-1:ticket-1").digest("base64url");
  const executor = { query: async <T>() => [{ route_name: "Route", mode: "bus" as const, origin_stop_id: "a", destination_stop_id: "b", quantity: 1, seat_labels: ["3"], reservation_status: "confirmed" as const, status: "issued" as const, fare_amount_minor: 100, fare_currency: "KES", issued_at: new Date("2026-09-01T06:00:00Z"), boarding_starts_at: new Date("2026-09-01T07:00:00Z"), boarding_ends_at: new Date("2026-09-01T07:30:00Z") }] as T[] };
  const { readPublicTransportTicket } = await import("./transport.js");
  const ticket = await readPublicTransportTicket(executor, token, "booking-secret");
  assert.deepEqual(ticket?.seatLabels, ["3"]);
});

test("discovers only published public transport trips through an active QR destination", async () => {
  const destination = { public_code: "transport-public-code-1", tenant_id: "tenant-1", branch_id: null, pack_id: null, service_id: null, campaign: null, status: "active" as const, expires_at: null };
  const publicTrip = { id: "trip-1", route_name: "CBD — Westlands", mode: "matatu" as const, capacity_mode: "open" as const, capacity: 33, reserved_quantity: 4, boarding_starts_at: tripRow.boarding_starts_at, boarding_ends_at: tripRow.boarding_ends_at, stops };
  const executor = { query: async <T>(sql: string) => sql.startsWith("SELECT public_code") ? [destination] as T[] : sql.startsWith("SELECT trip.id") ? [publicTrip] as T[] : [] as T[] };
  const trips = await listPublicTransportTrips(executor, "tenant-1", "transport-public-code-1");
  assert.equal(trips[0]?.remainingCapacity, 29);
  assert.equal(trips[0]?.stops[1]?.stopId, "westlands");
});

test("creates a public transport reservation with a canonical customer profile", async () => {
  const destination = { public_code: "transport-public-code-1", tenant_id: "tenant-1", branch_id: null, pack_id: null, service_id: null, campaign: null, status: "active" as const, expires_at: null };
  const reservationRow = { id: "reservation-1", tenant_id: "tenant-1", occurrence_id: "occurrence-1", customer_id: "customer-1", quantity: 2, status: "confirmed" as const, create_idempotency_key: "public-transport-1" };
  const executor = { query: async <T>(sql: string) => {
    if (sql.startsWith("SELECT public_code")) return [destination] as T[];
    if (sql.includes("FROM transport_trip_reservations")) return [] as T[];
    if (sql.startsWith("SELECT trip.id")) return [{ ...tripRow, reserved_quantity: 2 }] as T[];
    if (sql.startsWith("INSERT INTO customers")) return [{ id: "customer-1", tenant_id: "tenant-1", display_name: "Alex", preferred_locale: null, timezone: null, status: "active" }] as T[];
    if (sql.includes("FROM transport_trips")) return [{ ...tripRow, reserved_quantity: 2 }] as T[];
    if (sql.includes("FROM transport_route_stops")) return stops as T[];
    if (sql.startsWith("UPDATE transport_trips")) return [{ ...tripRow, reserved_quantity: 4 }] as T[];
    if (sql.startsWith("UPDATE service_occurrences")) return [{ id: "occurrence-1" }] as T[];
    if (sql.startsWith("INSERT INTO service_reservations")) return [reservationRow] as T[];
    return [] as T[];
  } };
  const reservation = await createPublicTransportPassengerReservation(executor, { tenantId: "tenant-1", publicCode: "transport-public-code-1", tripId: "trip-1", customerName: "Alex", originStopId: "cbd", destinationStopId: "westlands", quantity: 2, idempotencyKey: "public-transport-1" });
  assert.equal(reservation.customerId, "customer-1");
  assert.equal(reservation.status, "confirmed");
});

test("boards an issued ticket once and records audit evidence", async () => {
  const statements: string[] = [];
  const executor = { query: async <T>(sql: string) => {
    statements.push(sql);
    if (sql.startsWith("SELECT id, tenant_id, trip_id, reservation_id, ticket_id")) return [] as T[];
    if (sql.startsWith("SELECT ticket.reservation_id")) return [{ reservation_id: "reservation-1", status: "issued", reservation_status: "confirmed" }] as T[];
    if (sql.startsWith("INSERT INTO transport_boardings")) return [{ id: "boarding-1", tenant_id: "tenant-1", trip_id: "trip-1", reservation_id: "reservation-1", ticket_id: "ticket-1", actor_id: "staff-1", action: "boarded", idempotency_key: "board-retry-1", boarded_at: new Date("2026-09-01T07:05:00Z") }] as T[];
    if (sql.startsWith("UPDATE service_reservations")) return [{ id: "reservation-1" }] as T[];
    if (sql.startsWith("INSERT INTO audit_events")) return [{ id: "audit-1" }] as T[];
    return [] as T[];
  } };
  const result = await boardTransportTicket(executor, { id: "boarding-1", tenantId: "tenant-1", tripId: "trip-1", ticketId: "ticket-1", idempotencyKey: "board-retry-1", actorId: "staff-1" });
  assert.equal(result.action, "boarded");
  assert.ok(statements.some((statement) => statement.startsWith("INSERT INTO audit_events")));
});

test("cancels a public reservation through its expiring manage capability", async () => {
  const current = { id: "reservation-1", tenant_id: "tenant-1", trip_id: "trip-1", occurrence_id: "occurrence-1", customer_id: "customer-1", origin_stop_id: "cbd", destination_stop_id: "westlands", quantity: 2, status: "confirmed" as const, create_idempotency_key: "public-transport-1" };
  const executor = { query: async <T>(sql: string) => {
    if (sql.includes("manage_token_expires_at")) return [{ ...current, manage_token_expires_at: new Date(Date.now() + 60_000), boarding_starts_at: new Date(Date.now() + 60_000) }] as T[];
    if (sql.startsWith("SELECT tr.reservation_id")) return [current] as T[];
    if (sql.startsWith("UPDATE transport_trips") || sql.startsWith("UPDATE service_occurrences")) return [{ id: "capacity-1" }] as T[];
    if (sql.startsWith("UPDATE service_reservations")) return [{ ...current, status: "cancelled" }] as T[];
    if (sql.startsWith("INSERT INTO audit_events")) return [{ id: "audit-1" }] as T[];
    return [] as T[];
  } };
  const result = await cancelPublicTransportReservation(executor, { tenantId: "tenant-1", reservationId: "reservation-1", token: "opaque-manage-token", idempotencyKey: "cancel-retry-1" });
  assert.equal(result?.status, "cancelled");
});
