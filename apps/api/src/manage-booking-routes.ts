// Ownership: public opaque manage-booking routes. No tenant is accepted from the client.

import type { FastifyInstance } from "fastify";

export interface ManageBooking { id: string; tenantId: string; customerId: string; serviceName: string; startsAt: Date; endsAt: Date; status: string; resourceIds?: readonly string[]; }
export interface ManageBookingRouteDependencies {
  bookingManage?: {
    read(token: string): Promise<ManageBooking | null>;
    reschedule(token: string, startsAt: Date, endsAt: Date, idempotencyKey: string): Promise<ManageBooking | null>;
    cancel(token: string, idempotencyKey: string): Promise<ManageBooking | null>;
  };
}
function serialized(booking: ManageBooking): Record<string, unknown> { return { ...booking, startsAt: booking.startsAt.toISOString(), endsAt: booking.endsAt.toISOString() }; }
function missing(reply: { code(status: number): { send(body: unknown): unknown } }): unknown { return reply.code(503).send({ data: null, error: { code: "BOOKINGS_UNAVAILABLE", message: "Booking management is temporarily unavailable." } }); }
export function registerManageBookingRoutes(app: FastifyInstance, dependencies: ManageBookingRouteDependencies): void {
  app.get<{ Params: { token: string } }>("/v1/public/manage/:token", async (request, reply) => { if (!dependencies.bookingManage) return missing(reply); const booking = await dependencies.bookingManage.read(request.params.token); return booking ? reply.send({ data: serialized(booking), error: null }) : reply.code(404).send({ data: null, error: { code: "MANAGE_NOT_FOUND", message: "This booking link is no longer available." } }); });
  app.post<{ Params: { token: string }; Body: { startsAt: string; endsAt: string; idempotencyKey: string } }>("/v1/public/manage/:token/reschedule", async (request, reply) => { if (!dependencies.bookingManage) return missing(reply); const body = request.body; const startsAt = new Date(body?.startsAt ?? ""); const endsAt = new Date(body?.endsAt ?? ""); if (!body?.idempotencyKey?.trim() || body.idempotencyKey.length > 200 || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt || startsAt <= new Date()) return reply.code(400).send({ data: null, error: { code: "MANAGE_INVALID", message: "Choose a future ordered time and provide an idempotency key." } }); try { const booking = await dependencies.bookingManage.reschedule(request.params.token, startsAt, endsAt, body.idempotencyKey.trim()); return booking ? reply.send({ data: serialized(booking), error: null }) : reply.code(404).send({ data: null, error: { code: "MANAGE_NOT_FOUND", message: "This booking link is no longer available." } }); } catch (error) { return reply.code(409).send({ data: null, error: { code: "BOOKING_CONFLICT", message: error instanceof Error ? error.message : "That time is no longer available." } }); } });
  app.post<{ Params: { token: string }; Body: { idempotencyKey: string } }>("/v1/public/manage/:token/cancel", async (request, reply) => { if (!dependencies.bookingManage) return missing(reply); const key = request.body?.idempotencyKey?.trim(); if (!key || key.length > 200) return reply.code(400).send({ data: null, error: { code: "MANAGE_INVALID", message: "A valid idempotency key is required." } }); try { const booking = await dependencies.bookingManage.cancel(request.params.token, key); return booking ? reply.send({ data: serialized(booking), error: null }) : reply.code(404).send({ data: null, error: { code: "MANAGE_NOT_FOUND", message: "This booking link is no longer available." } }); } catch (error) { return reply.code(409).send({ data: null, error: { code: "BOOKING_CONFLICT", message: error instanceof Error ? error.message : "This booking could not be cancelled." } }); } });
}
