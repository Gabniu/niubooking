import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "./server.js";

const identity = { issuer: "https://novaauth.niuautomations.com", subject: "transport-user" };
const membership = { userId: "transport-user", tenantId: "tenant-transport", branchIds: [], role: "owner", status: "active" as const };
const resolve = (request: { params: { tenantId: string } }) => ({ identity, mappedUserId: "transport-user", membership, requestedTenantId: request.params.tenantId });
const route = { id: "route-1", tenantId: "tenant-transport", version: 1, name: "CBD to Westlands", mode: "matatu" as const, status: "published" as const, stops: [{ stopId: "cbd", sequence: 1, boardingMinutes: 5, alightingMinutes: 0 }, { stopId: "westlands", sequence: 2, boardingMinutes: 0, alightingMinutes: 5 }] };
const trip = { id: "trip-1", tenantId: "tenant-transport", routeId: "route-1", routeVersion: 1, occurrenceId: "occ-1", capacityMode: "open" as const, capacity: 14, boardingStartsAt: new Date("2026-08-20T06:00:00Z"), boardingEndsAt: new Date("2026-08-20T06:30:00Z"), vehicleResourceId: "vehicle-1" };

test("lists transport routes and trips with tenant authorization and date serialization", async () => {
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [route], createRoute: async (input) => input as typeof route, listTrips: async () => [trip], createTrip: async (input) => input as typeof trip } });
  const routes = await app.inject({ method: "GET", url: "/v1/tenants/tenant-transport/transport/routes" });
  assert.equal(routes.statusCode, 200);
  assert.equal(routes.json().data[0].stops[1].stopId, "westlands");
  const trips = await app.inject({ method: "GET", url: "/v1/tenants/tenant-transport/transport/trips?from=2026-08-20T00:00:00Z&to=2026-08-21T00:00:00Z" });
  assert.equal(trips.statusCode, 200);
  assert.equal(trips.json().data[0].boardingStartsAt, "2026-08-20T06:00:00.000Z");
});

test("creates a route and trip through the real HTTP contracts", async () => {
  const seen: { route?: unknown; trip?: unknown } = {};
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => { seen.route = input; return { ...route, ...input }; }, listTrips: async () => [], createTrip: async (input) => { seen.trip = input; return { ...trip, ...input }; } } });
  const routeResponse = await app.inject({ method: "POST", url: "/v1/tenants/tenant-transport/transport/routes", payload: { name: "CBD to Westlands", mode: "matatu", status: "published", stops: route.stops } });
  assert.equal(routeResponse.statusCode, 201);
  assert.equal((seen.route as { tenantId: string }).tenantId, "tenant-transport");
  const tripResponse = await app.inject({ method: "POST", url: "/v1/tenants/tenant-transport/transport/trips", payload: { routeId: "route-1", routeVersion: 1, occurrenceId: "occ-1", capacityMode: "open", capacity: 14, boardingStartsAt: "2026-08-20T06:00:00Z", boardingEndsAt: "2026-08-20T06:30:00Z", vehicleResourceId: "vehicle-1" } });
  assert.equal(tripResponse.statusCode, 201);
  assert.equal((seen.trip as { capacity: number }).capacity, 14);
});

test("rejects invalid transport filters and cross-tenant access", async () => {
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip } });
  assert.equal((await app.inject({ method: "GET", url: "/v1/tenants/tenant-transport/transport/trips?from=bad" })).statusCode, 400);
  assert.equal((await app.inject({ method: "GET", url: "/v1/tenants/other/transport/routes" })).statusCode, 403);
  assert.equal((await app.inject({ method: "POST", url: "/v1/tenants/tenant-transport/transport/routes", payload: { name: "Broken", mode: "bus", stops: [{ stopId: "only", sequence: 1, boardingMinutes: 0, alightingMinutes: 0 }] } })).statusCode, 400);
});

test("reports a clear unavailable response when transport persistence is not composed", async () => {
  const app = createApiServer({ resolve });
  const response = await app.inject({ method: "GET", url: "/v1/tenants/tenant-transport/transport/routes" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.message, "Transport routes are temporarily unavailable.");
});
