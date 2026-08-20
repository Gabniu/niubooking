import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "./server.js";

const identity = { issuer: "https://novaauth.niuautomations.com", subject: "transport-user" };
const membership = { userId: "transport-user", tenantId: "tenant-transport", branchIds: [], role: "owner", status: "active" as const };
const resolve = (request: { params: { tenantId: string } }) => ({ identity, mappedUserId: "transport-user", membership, requestedTenantId: request.params.tenantId });
const route = { id: "route-1", tenantId: "tenant-transport", version: 1, name: "CBD to Westlands", mode: "matatu" as const, status: "published" as const, stops: [{ stopId: "cbd", sequence: 1, boardingMinutes: 5, alightingMinutes: 0 }, { stopId: "westlands", sequence: 2, boardingMinutes: 0, alightingMinutes: 5 }] };
const trip = { id: "trip-1", tenantId: "tenant-transport", branchId: "branch-1", routeId: "route-1", routeVersion: 1, occurrenceId: "occ-1", capacityMode: "open" as const, capacity: 14, boardingStartsAt: new Date("2026-08-20T06:00:00Z"), boardingEndsAt: new Date("2026-08-20T06:30:00Z"), vehicleResourceId: "vehicle-1" };
const passengerReservation = { id: "reservation-1", tenantId: "tenant-transport", tripId: "trip-1", occurrenceId: "occ-1", customerId: "customer-1", originStopId: "cbd", destinationStopId: "westlands", quantity: 2, status: "confirmed" as const, createIdempotencyKey: "retry-123" };
const ticket = { id: "ticket-1", tenantId: "tenant-transport", tripId: "trip-1", reservationId: "reservation-1", fareAmountMinor: 2500, fareCurrency: "KES", status: "issued" as const, issuedAt: new Date("2026-08-19T10:00:00Z"), ticketToken: "opaque-ticket-token" };
const publicCode = "transport-public-code-1";
const publicDestination = { publicCode, tenantId: "tenant-transport", branchId: null, packId: "transport", serviceId: null, campaign: null, status: "active" as const, expiresAt: null };

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
  const tripResponse = await app.inject({ method: "POST", url: "/v1/tenants/tenant-transport/transport/trips", payload: { branchId: "branch-1", routeId: "route-1", routeVersion: 1, occurrenceId: "occ-1", capacityMode: "open", capacity: 14, boardingStartsAt: "2026-08-20T06:00:00Z", boardingEndsAt: "2026-08-20T06:30:00Z", vehicleResourceId: "vehicle-1" } });
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

test("creates and lists a tenant-safe passenger reservation", async () => {
  const seen: { reservation?: unknown } = {};
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [route], createRoute: async (input) => input as typeof route, listTrips: async () => [trip], createTrip: async (input) => input as typeof trip, listReservations: async () => [passengerReservation], createReservation: async (input) => { seen.reservation = input; return { ...passengerReservation, ...input }; } } });
  const listed = await app.inject({ method: "GET", url: "/v1/tenants/tenant-transport/transport/trips/trip-1/reservations" });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().data[0].originStopId, "cbd");
  const created = await app.inject({ method: "POST", url: "/v1/tenants/tenant-transport/transport/trips/trip-1/reservations", payload: { occurrenceId: "occ-1", customerId: "customer-1", originStopId: "cbd", destinationStopId: "westlands", quantity: 2, idempotencyKey: "retry-123" } });
  assert.equal(created.statusCode, 201);
  assert.equal((seen.reservation as { tripId: string }).tripId, "trip-1");
});

test("maps a full transport trip to a simple next step", async () => {
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip, listReservations: async () => [], createReservation: async () => { throw new Error("Trip capacity is unavailable"); } } });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-transport/transport/trips/trip-1/reservations", payload: { occurrenceId: "occ-1", customerId: "customer-1", originStopId: "cbd", destinationStopId: "westlands", quantity: 2, idempotencyKey: "retry-123" } });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.message, "That trip is full. Please choose another trip.");
});

test("updates passenger status through the tenant contract", async () => {
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip, listReservations: async () => [], createReservation: async (input) => ({ ...passengerReservation, ...input }), setReservationStatus: async (input) => ({ ...passengerReservation, ...input }) } });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-transport/transport/trips/trip-1/reservations/reservation-1/status", payload: { status: "cancelled" } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.status, "cancelled");
});

test("assigns seats through the tenant contract and keeps conflict copy simple", async () => {
  const assigned = { ...passengerReservation, seatLabels: ["1", "2"] as readonly string[] };
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip, listReservations: async () => [], createReservation: async (input) => ({ ...passengerReservation, ...input }), assignSeats: async (input) => ({ ...assigned, ...input }) } });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-transport/transport/trips/trip-1/reservations/reservation-1/seats", payload: { seatLabels: ["1", "2"] } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data.seatLabels, ["1", "2"]);

  const conflictApp = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip, assignSeats: async () => { throw new Error("One of those seats is already assigned"); } } });
  const conflict = await conflictApp.inject({ method: "POST", url: "/v1/tenants/tenant-transport/transport/trips/trip-1/reservations/reservation-1/seats", payload: { seatLabels: ["1", "2"] } });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().error.message, "One of those seats was just taken. Please choose different seats.");
});

test("issues tickets and exposes a staff manifest without leaking token dates", async () => {
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip, listReservations: async () => [], createReservation: async (input) => ({ ...passengerReservation, ...input }), setReservationStatus: async (input) => ({ ...passengerReservation, ...input }), listManifest: async () => [{ reservation: passengerReservation, ticket }], createTicket: async (input) => ({ ...ticket, ...input }) } });
  const manifest = await app.inject({ method: "GET", url: "/v1/tenants/tenant-transport/transport/trips/trip-1/manifest" });
  assert.equal(manifest.statusCode, 200);
  assert.equal(manifest.json().data[0].ticket.issuedAt, "2026-08-19T10:00:00.000Z");
  const issued = await app.inject({ method: "POST", url: "/v1/tenants/tenant-transport/transport/trips/trip-1/reservations/reservation-1/ticket", payload: { fareAmountMinor: 2500, fareCurrency: "kes" } });
  assert.equal(issued.statusCode, 201);
  assert.equal(issued.json().data.fareCurrency, "KES");
});

test("retrieves a public ticket without exposing tenant or customer identity", async () => {
  const publicTicket = { routeName: "CBD — Westlands", mode: "matatu" as const, originStopId: "cbd", destinationStopId: "westlands", quantity: 2, reservationStatus: "confirmed" as const, status: "issued" as const, fareAmountMinor: 2500, fareCurrency: "KES", issuedAt: new Date("2026-08-19T10:00:00Z"), boardingStartsAt: new Date("2026-08-20T06:00:00Z"), boardingEndsAt: new Date("2026-08-20T06:30:00Z") };
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip, readPublicTicket: async () => publicTicket } });
  const token = "a".repeat(43);
  const response = await app.inject({ method: "GET", url: `/v1/public/transport/tickets/${token}` });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.routeName, "CBD — Westlands");
  assert.equal(response.json().data.issuedAt, "2026-08-19T10:00:00.000Z");
  assert.equal("tenantId" in response.json().data, false);
  assert.equal("customerId" in response.json().data, false);
});

test("retrieves a ticket-scoped live projection without leaking fleet scope", async () => {
  const projection = { tripId: "trip-1", routeLabel: "CBD - Westlands", capturedAt: "2026-08-20T06:12:00.000Z", freshness: "live" as const, latitude: -1.28, longitude: 36.81, accuracyMetres: 8, headingDegrees: 90, eta: null };
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip, readPublicLiveTrip: async () => ({ tenantId: "tenant-transport", projection }) } });
  const response = await app.inject({ method: "GET", url: `/v1/public/transport/tickets/${"a".repeat(43)}/live` });
  assert.equal(response.statusCode, 200); assert.deepEqual(response.json().data, projection); assert.equal("tenantId" in response.json().data, false); assert.equal("vehicleLabel" in response.json().data, false);
});

test("does not accept malformed public live tracking links", async () => {
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip, readPublicLiveTrip: async () => null } });
  const response = await app.inject({ method: "GET", url: "/v1/public/transport/tickets/not-a-ticket/live" });
  assert.equal(response.statusCode, 404); assert.equal(response.json().error.code, "TRACKING_LINK_INVALID");
});

test("fails closed when public live streaming is not composed", async () => {
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip, readPublicLiveTrip: async () => null } });
  const response = await app.inject({ method: "GET", url: `/v1/public/transport/tickets/${"a".repeat(43)}/live/stream` });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "LIVE_TRIP_UNAVAILABLE");
});

test("discovers public transport trips through an active QR destination", async () => {
  const publicTrip = { id: "trip-1", routeName: "CBD — Westlands", mode: "matatu" as const, stops: route.stops, capacityMode: "open" as const, capacity: 14, remainingCapacity: 12, boardingStartsAt: trip.boardingStartsAt, boardingEndsAt: trip.boardingEndsAt };
  const app = createApiServer({ resolve, qrReader: { findByPublicCode: async () => publicDestination }, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip, discoverPublicTrips: async () => [publicTrip] } });
  const response = await app.inject({ method: "GET", url: `/v1/public/qr/${publicCode}/transport/trips` });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data[0].routeName, "CBD — Westlands");
  assert.equal(response.json().data[0].boardingStartsAt, "2026-08-20T06:00:00.000Z");
});

test("creates a public transport reservation without returning customer identity", async () => {
  const seen: { input?: unknown } = {};
  const app = createApiServer({ resolve, qrReader: { findByPublicCode: async () => publicDestination }, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip, reservePublic: async (input) => { seen.input = input; return passengerReservation; } } });
  const response = await app.inject({ method: "POST", url: `/v1/public/qr/${publicCode}/transport/trips/trip-1/reservations`, payload: { customerName: "Alex", originStopId: "cbd", destinationStopId: "westlands", quantity: 2, idempotencyKey: "public-transport-1", contact: { channel: "sms", destination: "+254700000000", consentGranted: true } } });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.tripId, "trip-1");
  assert.equal("customerId" in response.json().data, false);
  assert.equal((seen.input as { tenantId: string }).tenantId, "tenant-transport");
});

test("cancels a public transport reservation through its opaque manage link", async () => {
  const token = `${"a".repeat(32)}.${"b".repeat(43)}`;
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip, cancelPublic: async () => ({ ...passengerReservation, status: "cancelled" }) } });
  const response = await app.inject({ method: "POST", url: `/v1/public/transport/reservations/${token}/cancel`, payload: { idempotencyKey: "cancel-retry-1" } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.status, "cancelled");
  assert.equal("customerId" in response.json().data, false);
});

test("boards a ticket through an idempotent staff action", async () => {
  const boarding = { id: "boarding-1", tenantId: "tenant-transport", tripId: "trip-1", reservationId: "reservation-1", ticketId: "ticket-1", actorId: "transport-user", action: "boarded" as const, idempotencyKey: "board-retry-1", boardedAt: new Date("2026-08-20T06:05:00Z") };
  const app = createApiServer({ resolve, transportAdmin: { listRoutes: async () => [], createRoute: async (input) => input as typeof route, listTrips: async () => [], createTrip: async (input) => input as typeof trip, boardTicket: async () => boarding } });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-transport/transport/trips/trip-1/tickets/ticket-1/board", payload: { idempotencyKey: "board-retry-1" } });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.action, "boarded");
  assert.equal(response.json().data.boardedAt, "2026-08-20T06:05:00.000Z");
});
