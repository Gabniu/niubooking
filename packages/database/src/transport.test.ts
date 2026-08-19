import assert from "node:assert/strict";
import test from "node:test";
import { createTransportPassengerReservation, createTransportRoute, createTransportTrip, listTransportPassengerReservations, listTransportRoutes, listTransportTrips, setTransportPassengerReservationStatus } from "./transport.js";

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
