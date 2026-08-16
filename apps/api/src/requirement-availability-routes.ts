// Ownership: tenant-authorized advisory matching route; confirmation is a separate atomic command.

import type { FastifyInstance, FastifyRequest } from "fastify";
import { resolveQrDestination, type AvailabilityWindow, type QrDestinationReader, type RequirementAvailabilityResult } from "@bookingapp/domain";
import type { TenantContextRequest } from "./tenant-context-handler.js";

export interface RequirementAvailabilityRouteDependencies {
  resolve(request: FastifyRequest<{ Params: { tenantId: string } }>): TenantContextRequest | Promise<TenantContextRequest>;
  requirementAvailabilityAdmin?: { find(tenantId: string, serviceId: string, variantId: string | null | undefined, window: AvailabilityWindow): Promise<RequirementAvailabilityResult> } | undefined;
  qrReader?: QrDestinationReader | undefined;
}
function allowed(context: TenantContextRequest, tenantId: string): boolean { return Boolean(context.identity && context.membership?.tenantId === tenantId && ["owner", "admin", "manager"].includes(context.membership.role)); }
function parseWindow(query: { from?: string; to?: string; durationMinutes?: string; stepMinutes?: string }): AvailabilityWindow | null { const from = new Date(query.from ?? ""); const to = new Date(query.to ?? ""); const durationMinutes = Number(query.durationMinutes ?? "30"); const stepMinutes = Number(query.stepMinutes ?? "30"); if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || !Number.isInteger(durationMinutes) || !Number.isInteger(stepMinutes) || durationMinutes < 5 || durationMinutes > 1440 || stepMinutes < 5 || stepMinutes > 1440) return null; return { from, to, durationMinutes, stepMinutes }; }
function serialize(result: RequirementAvailabilityResult): RequirementAvailabilityResult { return { slots: result.slots.map((slot) => ({ startsAt: slot.startsAt, endsAt: slot.endsAt, assignments: slot.assignments })), rejected: result.rejected }; }
export function registerRequirementAvailabilityRoutes(app: FastifyInstance, dependencies: RequirementAvailabilityRouteDependencies): void {
  app.get<{ Params: { tenantId: string; serviceId: string }; Querystring: { variantId?: string; from?: string; to?: string; durationMinutes?: string; stepMinutes?: string } }>("/v1/tenants/:tenantId/services/:serviceId/requirement-availability", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.requirementAvailabilityAdmin) return reply.code(503).send({ data: null, error: { code: "REQUIREMENT_AVAILABILITY_UNAVAILABLE", message: "Requirement availability is temporarily unavailable." } });
    const window = parseWindow(request.query);
    if (!window) return reply.code(400).send({ data: null, error: { code: "REQUIREMENT_AVAILABILITY_INVALID", message: "Availability window parameters are invalid." } });
    try { return reply.send({ data: serialize(await dependencies.requirementAvailabilityAdmin.find(request.params.tenantId, request.params.serviceId, request.query.variantId ?? null, window)), error: null }); } catch { return reply.code(503).send({ data: null, error: { code: "REQUIREMENT_AVAILABILITY_UNAVAILABLE", message: "Requirement availability is temporarily unavailable." } }); }
  });
  app.get<{ Params: { publicCode: string }; Querystring: { variantId?: string; from?: string; to?: string; durationMinutes?: string; stepMinutes?: string } }>("/v1/public/qr/:publicCode/requirement-availability", async (request, reply) => {
    if (!dependencies.qrReader || !dependencies.requirementAvailabilityAdmin) return reply.code(503).send({ data: null, error: { code: "REQUIREMENT_AVAILABILITY_UNAVAILABLE", message: "Requirement availability is temporarily unavailable." } });
    const resolution = await resolveQrDestination(dependencies.qrReader, request.params.publicCode);
    if (!resolution.ok) { const code = resolution.reason === "expired" ? "QR_EXPIRED" : resolution.reason === "inactive" ? "QR_INACTIVE" : "QR_NOT_FOUND"; return reply.code(code === "QR_NOT_FOUND" ? 404 : 410).send({ data: null, error: { code, message: "This booking link is not available." } }); }
    if (!resolution.destination.serviceId) return reply.code(400).send({ data: null, error: { code: "REQUIREMENT_AVAILABILITY_INVALID", message: "This booking link is not connected to a schedulable service." } });
    const window = parseWindow(request.query);
    if (!window) return reply.code(400).send({ data: null, error: { code: "REQUIREMENT_AVAILABILITY_INVALID", message: "Availability window parameters are invalid." } });
    try { return reply.send({ data: serialize(await dependencies.requirementAvailabilityAdmin.find(resolution.destination.tenantId, resolution.destination.serviceId, request.query.variantId ?? null, window)), error: null }); } catch { return reply.code(503).send({ data: null, error: { code: "REQUIREMENT_AVAILABILITY_UNAVAILABLE", message: "Requirement availability is temporarily unavailable." } }); }
  });
}
