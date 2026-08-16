// Ownership: tenant-authorized occurrence and reservation HTTP routes.

import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { resolveQrDestination, type CommunicationChannel, type QrDestinationReader, type ReservationDraft, type ReservationStatus, type ServiceOccurrence, type ServiceOccurrenceDraft } from "@bookingapp/domain";
import type { PublicOccurrenceReservationInput } from "@bookingapp/database";
import type { TenantContextRequest } from "./tenant-context-handler.js";

interface RouteDependencies {
  resolve(request: FastifyRequest<{ Params: { tenantId: string } }>): TenantContextRequest | Promise<TenantContextRequest>;
  qrReader?: QrDestinationReader;
  occurrenceAdmin?: {
    list(tenantId: string, from?: Date, to?: Date): Promise<readonly unknown[]>;
    create(draft: ServiceOccurrenceDraft): Promise<unknown>;
    reserve(draft: ReservationDraft): Promise<unknown>;
    listReservations?(tenantId: string, occurrenceId: string): Promise<readonly unknown[]>;
    setReservationStatus?(input: { tenantId: string; occurrenceId: string; reservationId: string; status: ReservationStatus; actorId?: string }): Promise<unknown>;
    reservePublic?(input: PublicOccurrenceReservationInput): Promise<import("@bookingapp/domain").Reservation>;
    discover?(tenantId: string, serviceId: string | null, from?: Date, to?: Date): Promise<readonly ServiceOccurrence[]>;
  };
}

function allowed(context: TenantContextRequest, tenantId: string, roles = ["owner", "admin", "manager"]): boolean {
  return Boolean(context.identity && context.membership && context.membership.tenantId === tenantId && roles.includes(context.membership.role));
}

function parseDates(query: { from?: string; to?: string }): { from?: Date; to?: Date } | null {
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;
  if (from && Number.isNaN(from.getTime())) return null;
  if (to && Number.isNaN(to.getTime())) return null;
  if (from && to && to <= from) return null;
  return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

function serialize(value: { startsAt: Date; endsAt: Date; [key: string]: unknown }): Record<string, unknown> {
  return { ...value, startsAt: value.startsAt.toISOString(), endsAt: value.endsAt.toISOString() };
}

function serializePublic(value: ServiceOccurrence): Record<string, unknown> {
  return { id: value.id, serviceId: value.serviceId, label: value.label, startsAt: value.startsAt.toISOString(), endsAt: value.endsAt.toISOString(), capacity: value.capacity, remainingCapacity: value.capacity === null ? null : Math.max(0, value.capacity - value.reservedQuantity) };
}

const reservationStatuses = new Set<ReservationStatus>(["held", "confirmed", "checked_in", "completed", "cancelled", "no_show"]);

export function registerOccurrenceRoutes(app: FastifyInstance, dependencies: RouteDependencies): void {
  app.get<{ Params: { publicCode: string }; Querystring: { from?: string; to?: string } }>("/v1/public/qr/:publicCode/occurrences", async (request, reply) => {
    if (!dependencies.qrReader || !dependencies.occurrenceAdmin?.discover) return reply.code(503).send({ data: null, error: { code: "OCCURRENCES_UNAVAILABLE", message: "Public occurrences are temporarily unavailable." } });
    const resolution = await resolveQrDestination(dependencies.qrReader, request.params.publicCode);
    if (!resolution.ok) { const code = resolution.reason === "expired" ? "QR_EXPIRED" : resolution.reason === "inactive" ? "QR_INACTIVE" : "QR_NOT_FOUND"; return reply.code(code === "QR_NOT_FOUND" ? 404 : 410).send({ data: null, error: { code, message: "This booking link is not available." } }); }
    const dates = parseDates(request.query);
    if (!dates) return reply.code(400).send({ data: null, error: { code: "OCCURRENCE_INVALID", message: "Occurrence date filters are invalid." } });
    const values = await dependencies.occurrenceAdmin.discover(resolution.destination.tenantId, resolution.destination.serviceId, dates.from, dates.to);
    return reply.send({ data: values.filter((value) => value.status === "published" || value.status === "open").map(serializePublic), error: null });
  });

  app.post<{ Params: { publicCode: string; occurrenceId: string }; Body: { customerName: string; quantity: number; idempotencyKey: string; contact?: { channel: CommunicationChannel; destination: string; consentGranted: boolean } } }>("/v1/public/qr/:publicCode/occurrences/:occurrenceId/reservations", async (request, reply) => {
    if (!dependencies.qrReader || !dependencies.occurrenceAdmin?.reservePublic) return reply.code(503).send({ data: null, error: { code: "RESERVATIONS_UNAVAILABLE", message: "Public reservations are temporarily unavailable." } });
    const resolution = await resolveQrDestination(dependencies.qrReader, request.params.publicCode);
    if (!resolution.ok) { const code = resolution.reason === "expired" ? "QR_EXPIRED" : resolution.reason === "inactive" ? "QR_INACTIVE" : "QR_NOT_FOUND"; return reply.code(code === "QR_NOT_FOUND" ? 404 : 410).send({ data: null, error: { code, message: "This booking link is not available." } }); }
    const body = request.body;
    const name = body?.customerName?.trim() ?? "";
    const key = body?.idempotencyKey?.trim() ?? "";
    const contact = body?.contact;
    const validChannel = contact?.channel === "email" || contact?.channel === "sms" || contact?.channel === "voice";
    const validContact = !contact || (validChannel && typeof contact.destination === "string" && contact.destination.trim().length > 0 && contact.destination.trim().length <= 320 && contact.consentGranted === true);
    if (name.length < 1 || name.length > 200 || !Number.isInteger(body?.quantity) || (body?.quantity ?? 0) <= 0 || key.length < 8 || key.length > 200 || !validContact) return reply.code(400).send({ data: null, error: { code: "OCCURRENCE_INVALID", message: "Name, positive quantity, idempotency key, and consented contact details are required." } });
    try {
      const reservation = await dependencies.occurrenceAdmin.reservePublic({ tenantId: resolution.destination.tenantId, publicCode: resolution.destination.publicCode, occurrenceId: request.params.occurrenceId, customerName: name, quantity: body.quantity, idempotencyKey: key, ...(contact ? { contact: { channel: contact.channel, destination: contact.destination.trim(), consentGranted: true } } : {}) });
      return reply.code(201).send({ data: { reservationId: reservation.id, occurrenceId: reservation.occurrenceId, quantity: reservation.quantity, status: reservation.status }, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The occurrence is no longer available.";
      const invalid = /invalid|unavailable/iu.test(message);
      return reply.code(invalid ? 400 : 409).send({ data: null, error: { code: invalid ? "OCCURRENCE_INVALID" : "OCCURRENCE_FULL", message: invalid ? "This occurrence cannot be reserved from this booking link." : "This occurrence is no longer available." } });
    }
  });

  app.get<{ Params: { tenantId: string }; Querystring: { from?: string; to?: string } }>("/v1/tenants/:tenantId/occurrences", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.occurrenceAdmin) return reply.code(503).send({ data: null, error: { code: "OCCURRENCES_UNAVAILABLE", message: "Occurrences are temporarily unavailable." } });
    const dates = parseDates(request.query);
    if (!dates) return reply.code(400).send({ data: null, error: { code: "OCCURRENCE_INVALID", message: "Occurrence date filters are invalid." } });
    const values = await dependencies.occurrenceAdmin.list(request.params.tenantId, dates.from, dates.to);
    return reply.send({ data: values.map((value) => serialize(value as { startsAt: Date; endsAt: Date })), error: null });
  });

  app.post<{ Params: { tenantId: string }; Body: { serviceId: string; label: string; startsAt: string; endsAt: string; capacity: number | null; status?: ServiceOccurrenceDraft["status"] } }>("/v1/tenants/:tenantId/occurrences", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId, ["owner", "admin"])) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.occurrenceAdmin) return reply.code(503).send({ data: null, error: { code: "OCCURRENCES_UNAVAILABLE", message: "Occurrences are temporarily unavailable." } });
    const body = request.body;
    const startsAt = new Date(body?.startsAt ?? "");
    const endsAt = new Date(body?.endsAt ?? "");
    if (!body?.serviceId?.trim() || !body.label?.trim() || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt || (body.capacity !== null && (!Number.isInteger(body.capacity) || body.capacity <= 0))) return reply.code(400).send({ data: null, error: { code: "OCCURRENCE_INVALID", message: "Service, label, ordered times, and capacity are required." } });
    try {
      const value = await dependencies.occurrenceAdmin.create({ id: randomUUID(), tenantId: request.params.tenantId, serviceId: body.serviceId.trim(), label: body.label.trim(), startsAt, endsAt, capacity: body.capacity, ...(body.status ? { status: body.status } : {}) });
      return reply.code(201).send({ data: serialize(value as { startsAt: Date; endsAt: Date }), error: null });
    } catch (error) { return reply.code(400).send({ data: null, error: { code: "OCCURRENCE_INVALID", message: error instanceof Error ? error.message : "Occurrence could not be created." } }); }
  });

  app.post<{ Params: { tenantId: string; occurrenceId: string }; Body: { customerId: string; quantity: number } }>("/v1/tenants/:tenantId/occurrences/:occurrenceId/reservations", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.occurrenceAdmin) return reply.code(503).send({ data: null, error: { code: "RESERVATIONS_UNAVAILABLE", message: "Reservations are temporarily unavailable." } });
    if (!request.body?.customerId?.trim() || !Number.isInteger(request.body.quantity) || request.body.quantity <= 0) return reply.code(400).send({ data: null, error: { code: "OCCURRENCE_INVALID", message: "Customer and positive quantity are required." } });
    try { return reply.code(201).send({ data: await dependencies.occurrenceAdmin.reserve({ id: randomUUID(), tenantId: request.params.tenantId, occurrenceId: request.params.occurrenceId, customerId: request.body.customerId.trim(), quantity: request.body.quantity }), error: null }); } catch (error) { return reply.code(409).send({ data: null, error: { code: "OCCURRENCE_FULL", message: error instanceof Error ? error.message : "The occurrence is no longer available." } }); }
  });

  app.get<{ Params: { tenantId: string; occurrenceId: string } }>("/v1/tenants/:tenantId/occurrences/:occurrenceId/reservations", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.occurrenceAdmin?.listReservations) return reply.code(503).send({ data: null, error: { code: "RESERVATIONS_UNAVAILABLE", message: "Reservations are temporarily unavailable." } });
    try { return reply.send({ data: await dependencies.occurrenceAdmin.listReservations(request.params.tenantId, request.params.occurrenceId), error: null }); }
    catch { return reply.code(404).send({ data: null, error: { code: "OCCURRENCE_INVALID", message: "The occurrence could not be found." } }); }
  });

  app.post<{ Params: { tenantId: string; occurrenceId: string; reservationId: string }; Body: { status: ReservationStatus } }>("/v1/tenants/:tenantId/occurrences/:occurrenceId/reservations/:reservationId/status", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.occurrenceAdmin?.setReservationStatus) return reply.code(503).send({ data: null, error: { code: "RESERVATIONS_UNAVAILABLE", message: "Reservations are temporarily unavailable." } });
    if (!reservationStatuses.has(request.body?.status)) return reply.code(400).send({ data: null, error: { code: "OCCURRENCE_INVALID", message: "Choose a valid reservation status." } });
    try { return reply.send({ data: await dependencies.occurrenceAdmin.setReservationStatus({ tenantId: request.params.tenantId, occurrenceId: request.params.occurrenceId, reservationId: request.params.reservationId, status: request.body.status, ...(context.mappedUserId ? { actorId: context.mappedUserId } : {}) }), error: null }); }
    catch (error) { const message = error instanceof Error ? error.message : "Reservation status could not be updated."; const conflict = /capacity|cannot move|inventory/iu.test(message); return reply.code(conflict ? 409 : 404).send({ data: null, error: { code: conflict ? "RESERVATION_CONFLICT" : "OCCURRENCE_INVALID", message: conflict ? "This reservation status change is not available." : "The reservation could not be found." } }); }
  });
}
