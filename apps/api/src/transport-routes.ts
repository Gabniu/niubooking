// Ownership: tenant-authorized transport route and trip HTTP contracts.

import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { type CapacityMode, type PublicTransportTicket, type ReservationStatus, type TransportManifestEntry, type TransportMode, type TransportPassengerReservation, type TransportPassengerReservationDraft, type TransportRoute, type TransportRouteDraft, type TransportRouteStatus, type TransportStopRef, type TransportTicket, type TransportTrip, type TransportTripDraft } from "@bookingapp/domain";
import type { TenantContextRequest } from "./tenant-context-handler.js";

export interface TransportAdmin {
  listRoutes(tenantId: string): Promise<readonly TransportRoute[]>;
  createRoute(draft: TransportRouteDraft): Promise<TransportRoute>;
  listTrips(tenantId: string, from?: Date, to?: Date): Promise<readonly TransportTrip[]>;
  createTrip(draft: TransportTripDraft): Promise<TransportTrip>;
  listReservations?(tenantId: string, tripId: string): Promise<readonly TransportPassengerReservation[]>;
  createReservation?(draft: TransportPassengerReservationDraft): Promise<TransportPassengerReservation>;
  setReservationStatus?(input: { tenantId: string; tripId: string; reservationId: string; status: ReservationStatus; actorId?: string }): Promise<TransportPassengerReservation>;
  listManifest?(tenantId: string, tripId: string): Promise<readonly TransportManifestEntry[]>;
  createTicket?(draft: Pick<TransportTicket, "id" | "tenantId" | "tripId" | "reservationId" | "fareAmountMinor" | "fareCurrency">): Promise<TransportTicket>;
  readPublicTicket?(token: string): Promise<PublicTransportTicket | null>;
}

export interface TransportRouteDependencies {
  resolve(request: FastifyRequest<{ Params: { tenantId: string } }>): TenantContextRequest | Promise<TenantContextRequest>;
  transportAdmin?: TransportAdmin;
}

const modes = new Set<TransportMode>(["bus", "matatu", "shuttle", "charter"]);
const statuses = new Set<TransportRouteStatus>(["draft", "published", "archived"]);
const capacityModes = new Set<CapacityMode>(["seat", "open"]);

function allowed(context: TenantContextRequest, tenantId: string, roles = ["owner", "admin", "manager"]): boolean {
  return Boolean(context.identity && context.membership && context.membership.tenantId === tenantId && roles.includes(context.membership.role));
}

function dates(query: { from?: string; to?: string }): { from?: Date; to?: Date } | null {
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && to <= from)) return null;
  return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

function routeStops(value: unknown): TransportStopRef[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 256) return null;
  const stops = value.map((stop) => ({ stopId: typeof stop?.stopId === "string" ? stop.stopId.trim() : "", sequence: stop?.sequence, boardingMinutes: stop?.boardingMinutes, alightingMinutes: stop?.alightingMinutes }));
  const ordered = stops.every((stop, index) => stop.sequence === index + 1);
  return ordered && stops.every((stop) => stop.stopId.length > 0 && stop.stopId.length <= 120 && Number.isInteger(stop.sequence) && Number.isInteger(stop.boardingMinutes) && Number.isInteger(stop.alightingMinutes) && stop.boardingMinutes >= 0 && stop.alightingMinutes >= 0) ? stops as TransportStopRef[] : null;
}

function serializeRoute(route: TransportRoute): Record<string, unknown> { return { ...route, stops: route.stops.map((stop) => ({ ...stop })) }; }
function serializeTrip(trip: TransportTrip): Record<string, unknown> { return { ...trip, boardingStartsAt: trip.boardingStartsAt.toISOString(), boardingEndsAt: trip.boardingEndsAt.toISOString() }; }
function serializeReservation(reservation: TransportPassengerReservation): Record<string, unknown> { return { ...reservation }; }
function serializeTicket(ticket: TransportTicket): Record<string, unknown> { return { ...ticket, issuedAt: ticket.issuedAt.toISOString() }; }
function serializeManifest(entry: TransportManifestEntry): Record<string, unknown> { return { reservation: serializeReservation(entry.reservation), ticket: entry.ticket ? serializeTicket(entry.ticket) : null }; }
function serializePublicTicket(ticket: PublicTransportTicket): Record<string, unknown> { return { ...ticket, issuedAt: ticket.issuedAt.toISOString(), boardingStartsAt: ticket.boardingStartsAt.toISOString(), boardingEndsAt: ticket.boardingEndsAt.toISOString() }; }

export function registerTransportRoutes(app: FastifyInstance, dependencies: TransportRouteDependencies): void {
  app.get<{ Params: { token: string } }>("/v1/public/transport/tickets/:token", async (request, reply) => {
    if (!dependencies.transportAdmin?.readPublicTicket) return reply.code(503).send({ data: null, error: { code: "TRANSPORT_UNAVAILABLE", message: "Public ticket lookup is temporarily unavailable." } });
    if (!/^[A-Za-z0-9_-]{32,256}$/u.test(request.params.token)) return reply.code(404).send({ data: null, error: { code: "TRANSPORT_TICKET_NOT_FOUND", message: "This ticket link is not available." } });
    const ticket = await dependencies.transportAdmin.readPublicTicket(request.params.token);
    return ticket ? reply.send({ data: serializePublicTicket(ticket), error: null }) : reply.code(404).send({ data: null, error: { code: "TRANSPORT_TICKET_NOT_FOUND", message: "This ticket link is not available." } });
  });

  app.get<{ Params: { tenantId: string } }>("/v1/tenants/:tenantId/transport/routes", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.transportAdmin) return reply.code(503).send({ data: null, error: { code: "TRANSPORT_UNAVAILABLE", message: "Transport routes are temporarily unavailable." } });
    return reply.send({ data: (await dependencies.transportAdmin.listRoutes(request.params.tenantId)).map(serializeRoute), error: null });
  });

  app.post<{ Params: { tenantId: string }; Body: { name: string; mode: TransportMode; version?: number; status?: TransportRouteStatus; stops: unknown } }>("/v1/tenants/:tenantId/transport/routes", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId, ["owner", "admin"])) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.transportAdmin) return reply.code(503).send({ data: null, error: { code: "TRANSPORT_UNAVAILABLE", message: "Transport routes are temporarily unavailable." } });
    const body = request.body;
    const stops = routeStops(body?.stops);
    if (!body?.name?.trim() || body.name.trim().length > 200 || !modes.has(body.mode) || (body.version !== undefined && (!Number.isInteger(body.version) || body.version < 1)) || (body.status !== undefined && !statuses.has(body.status)) || !stops) return reply.code(400).send({ data: null, error: { code: "TRANSPORT_ROUTE_INVALID", message: "Route name, mode, version, and ordered stops are required." } });
    const draft: TransportRouteDraft = { id: randomUUID(), tenantId: request.params.tenantId, version: body.version ?? 1, name: body.name.trim(), mode: body.mode, stops, ...(body.status ? { status: body.status } : {}) };
    try { return reply.code(201).send({ data: serializeRoute(await dependencies.transportAdmin.createRoute(draft)), error: null }); }
    catch (error) { return reply.code(400).send({ data: null, error: { code: "TRANSPORT_ROUTE_INVALID", message: error instanceof Error ? error.message : "Route could not be created." } }); }
  });

  app.get<{ Params: { tenantId: string }; Querystring: { from?: string; to?: string } }>("/v1/tenants/:tenantId/transport/trips", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.transportAdmin) return reply.code(503).send({ data: null, error: { code: "TRANSPORT_UNAVAILABLE", message: "Transport trips are temporarily unavailable." } });
    const window = dates(request.query);
    if (!window) return reply.code(400).send({ data: null, error: { code: "TRANSPORT_TRIP_INVALID", message: "Trip date filters are invalid." } });
    return reply.send({ data: (await dependencies.transportAdmin.listTrips(request.params.tenantId, window.from, window.to)).map(serializeTrip), error: null });
  });

  app.post<{ Params: { tenantId: string }; Body: { routeId: string; routeVersion: number; occurrenceId: string; capacityMode: CapacityMode; capacity: number; boardingStartsAt: string; boardingEndsAt: string; vehicleResourceId?: string | null } }>("/v1/tenants/:tenantId/transport/trips", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId, ["owner", "admin"])) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.transportAdmin) return reply.code(503).send({ data: null, error: { code: "TRANSPORT_UNAVAILABLE", message: "Transport trips are temporarily unavailable." } });
    const body = request.body;
    const startsAt = new Date(body?.boardingStartsAt ?? "");
    const endsAt = new Date(body?.boardingEndsAt ?? "");
    if (!body?.routeId?.trim() || !body?.occurrenceId?.trim() || !Number.isInteger(body.routeVersion) || body.routeVersion < 1 || !capacityModes.has(body.capacityMode) || !Number.isInteger(body.capacity) || body.capacity <= 0 || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt || (body.vehicleResourceId !== undefined && body.vehicleResourceId !== null && (typeof body.vehicleResourceId !== "string" || body.vehicleResourceId.trim().length > 120))) return reply.code(400).send({ data: null, error: { code: "TRANSPORT_TRIP_INVALID", message: "Route, occurrence, capacity, and a valid boarding window are required." } });
    const draft: TransportTripDraft = { id: randomUUID(), tenantId: request.params.tenantId, routeId: body.routeId.trim(), routeVersion: body.routeVersion, occurrenceId: body.occurrenceId.trim(), capacityMode: body.capacityMode, capacity: body.capacity, boardingStartsAt: startsAt, boardingEndsAt: endsAt, vehicleResourceId: body.vehicleResourceId?.trim() || null };
    try { return reply.code(201).send({ data: serializeTrip(await dependencies.transportAdmin.createTrip(draft)), error: null }); }
    catch (error) { return reply.code(400).send({ data: null, error: { code: "TRANSPORT_TRIP_INVALID", message: error instanceof Error ? error.message : "Trip could not be created." } }); }
  });

  app.get<{ Params: { tenantId: string; tripId: string } }>("/v1/tenants/:tenantId/transport/trips/:tripId/reservations", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.transportAdmin?.listReservations) return reply.code(503).send({ data: null, error: { code: "TRANSPORT_UNAVAILABLE", message: "Transport reservations are temporarily unavailable." } });
    return reply.send({ data: (await dependencies.transportAdmin.listReservations(request.params.tenantId, request.params.tripId)).map(serializeReservation), error: null });
  });

  app.post<{ Params: { tenantId: string; tripId: string }; Body: { occurrenceId: string; customerId: string; originStopId: string; destinationStopId: string; quantity: number; idempotencyKey: string; status?: "held" | "confirmed" } }>("/v1/tenants/:tenantId/transport/trips/:tripId/reservations", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.transportAdmin?.createReservation) return reply.code(503).send({ data: null, error: { code: "TRANSPORT_UNAVAILABLE", message: "Transport reservations are temporarily unavailable." } });
    const body = request.body;
    const text = [body?.occurrenceId, body?.customerId, body?.originStopId, body?.destinationStopId, body?.idempotencyKey];
    if (text.some((value) => typeof value !== "string" || !value.trim()) || text.some((value) => typeof value === "string" && value.trim().length > 200) || !Number.isInteger(body?.quantity) || (body?.quantity ?? 0) <= 0 || (body?.status !== undefined && body.status !== "held" && body.status !== "confirmed")) return reply.code(400).send({ data: null, error: { code: "TRANSPORT_RESERVATION_INVALID", message: "Trip, passenger, stops, quantity, and a retry key are required." } });
    const draft: TransportPassengerReservationDraft = { id: randomUUID(), tenantId: request.params.tenantId, tripId: request.params.tripId, occurrenceId: body.occurrenceId.trim(), customerId: body.customerId.trim(), originStopId: body.originStopId.trim(), destinationStopId: body.destinationStopId.trim(), quantity: body.quantity, createIdempotencyKey: body.idempotencyKey.trim(), ...(body.status ? { status: body.status } : {}) };
    try { return reply.code(201).send({ data: serializeReservation(await dependencies.transportAdmin.createReservation(draft)), error: null }); }
    catch (error) { const message = error instanceof Error ? error.message : "Passenger reservation could not be created."; const conflict = /capacity|unavailable/iu.test(message); return reply.code(conflict ? 409 : 400).send({ data: null, error: { code: conflict ? "TRANSPORT_CAPACITY_FULL" : "TRANSPORT_RESERVATION_INVALID", message: conflict ? "That trip is full. Please choose another trip." : message } }); }
  });

  app.post<{ Params: { tenantId: string; tripId: string; reservationId: string }; Body: { status: ReservationStatus } }>("/v1/tenants/:tenantId/transport/trips/:tripId/reservations/:reservationId/status", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.transportAdmin?.setReservationStatus) return reply.code(503).send({ data: null, error: { code: "TRANSPORT_UNAVAILABLE", message: "Transport reservation updates are temporarily unavailable." } });
    const status = request.body?.status;
    if (!["held", "confirmed", "checked_in", "completed", "cancelled", "no_show"].includes(status)) return reply.code(400).send({ data: null, error: { code: "TRANSPORT_RESERVATION_INVALID", message: "Choose a valid passenger reservation status." } });
    try { return reply.send({ data: serializeReservation(await dependencies.transportAdmin.setReservationStatus({ tenantId: request.params.tenantId, tripId: request.params.tripId, reservationId: request.params.reservationId, status, ...(context.mappedUserId ? { actorId: context.mappedUserId } : {}) })), error: null }); }
    catch (error) { const message = error instanceof Error ? error.message : "Passenger reservation status could not be updated."; const conflict = /capacity|inventory/iu.test(message); return reply.code(conflict ? 409 : 400).send({ data: null, error: { code: conflict ? "TRANSPORT_CAPACITY_CONFLICT" : "TRANSPORT_RESERVATION_INVALID", message: conflict ? "That passenger change is not available." : message } }); }
  });

  app.get<{ Params: { tenantId: string; tripId: string } }>("/v1/tenants/:tenantId/transport/trips/:tripId/manifest", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.transportAdmin?.listManifest) return reply.code(503).send({ data: null, error: { code: "TRANSPORT_UNAVAILABLE", message: "The trip manifest is temporarily unavailable." } });
    return reply.send({ data: (await dependencies.transportAdmin.listManifest(request.params.tenantId, request.params.tripId)).map(serializeManifest), error: null });
  });

  app.post<{ Params: { tenantId: string; tripId: string; reservationId: string }; Body: { fareAmountMinor: number; fareCurrency: string } }>("/v1/tenants/:tenantId/transport/trips/:tripId/reservations/:reservationId/ticket", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId, ["owner", "admin", "manager"])) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.transportAdmin?.createTicket) return reply.code(503).send({ data: null, error: { code: "TRANSPORT_UNAVAILABLE", message: "Ticket issuing is temporarily unavailable." } });
    const body = request.body;
    if (!Number.isInteger(body?.fareAmountMinor) || (body?.fareAmountMinor ?? -1) < 0 || typeof body.fareCurrency !== "string" || !/^[A-Za-z]{3}$/.test(body.fareCurrency)) return reply.code(400).send({ data: null, error: { code: "TRANSPORT_TICKET_INVALID", message: "Enter a valid fare and three-letter currency." } });
    try { const ticket = await dependencies.transportAdmin.createTicket({ id: randomUUID(), tenantId: request.params.tenantId, tripId: request.params.tripId, reservationId: request.params.reservationId, fareAmountMinor: body.fareAmountMinor, fareCurrency: body.fareCurrency.toUpperCase() }); return reply.code(201).send({ data: serializeTicket(ticket), error: null }); }
    catch (error) { return reply.code(400).send({ data: null, error: { code: "TRANSPORT_TICKET_INVALID", message: error instanceof Error ? error.message : "Ticket could not be issued." } }); }
  });
}
