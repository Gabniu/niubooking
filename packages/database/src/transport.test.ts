import assert from "node:assert/strict";
import test from "node:test";
import { createTransportRoute, createTransportTrip, listTransportRoutes, listTransportTrips } from "./transport.js";

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
