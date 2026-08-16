// Ownership: tenant-safe resource inventory and advisory availability routes.

import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { resolveQrDestination, type AvailabilityWindow, type QrDestinationReader } from "@bookingapp/domain";
import type { TenantContextRequest } from "./tenant-context-handler.js";

interface ResourceSlot { startsAt: Date; endsAt: Date; resourceIds: readonly string[]; }
export interface ResourceRouteDependencies {
  resolve(request: FastifyRequest<{ Params: { tenantId: string } }>): TenantContextRequest | Promise<TenantContextRequest>;
  qrReader?: QrDestinationReader;
  resourceAdmin?: {
    list(tenantId: string): Promise<readonly unknown[]>;
    create(input: { id: string; tenantId: string; name: string; resourceType: string; capabilities?: readonly string[] }): Promise<unknown>;
    setStatus(tenantId: string, resourceId: string, status: "active" | "inactive"): Promise<boolean>;
    availability(tenantId: string, window: AvailabilityWindow, requiredResourceCount?: number): Promise<readonly ResourceSlot[]>;
  };
}

function allowed(context: TenantContextRequest, tenantId: string, roles = ["owner", "admin", "manager"]): boolean { return Boolean(context.identity && context.membership && context.membership.tenantId === tenantId && roles.includes(context.membership.role)); }
function parseWindow(query: { from?: string; to?: string; durationMinutes?: string; stepMinutes?: string; requiredResourceCount?: string }): { window: AvailabilityWindow; requiredResourceCount: number } | null {
  const from = new Date(query.from ?? "");
  const to = new Date(query.to ?? "");
  const durationMinutes = Number(query.durationMinutes ?? "30");
  const stepMinutes = Number(query.stepMinutes ?? "30");
  const requiredResourceCount = Number(query.requiredResourceCount ?? "1");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || !Number.isInteger(durationMinutes) || !Number.isInteger(stepMinutes) || !Number.isInteger(requiredResourceCount) || durationMinutes <= 0 || stepMinutes <= 0 || requiredResourceCount <= 0 || to <= from) return null;
  return { window: { from, to, durationMinutes, stepMinutes }, requiredResourceCount };
}
function serialize(slots: readonly ResourceSlot[]): readonly unknown[] { return slots.map((slot) => ({ startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString(), resourceIds: slot.resourceIds })); }

export function registerResourceRoutes(app: FastifyInstance, dependencies: ResourceRouteDependencies): void {
  app.get<{ Params: { tenantId: string } }>("/v1/tenants/:tenantId/resources", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.resourceAdmin) return reply.code(503).send({ data: null, error: { code: "RESOURCES_UNAVAILABLE", message: "Resources are temporarily unavailable." } });
    return reply.send({ data: await dependencies.resourceAdmin.list(request.params.tenantId), error: null });
  });
  app.post<{ Params: { tenantId: string }; Body: { name: string; resourceType: string; capabilities?: string[] } }>("/v1/tenants/:tenantId/resources", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId, ["owner", "admin"])) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.resourceAdmin) return reply.code(503).send({ data: null, error: { code: "RESOURCES_UNAVAILABLE", message: "Resources are temporarily unavailable." } });
    if (!request.body?.name?.trim() || !request.body?.resourceType?.trim() || (request.body.capabilities !== undefined && (!Array.isArray(request.body.capabilities) || request.body.capabilities.length > 32 || request.body.capabilities.some((capability) => typeof capability !== "string")))) return reply.code(400).send({ data: null, error: { code: "RESOURCE_INVALID", message: "Resource name, type, and bounded capabilities are required." } });
    try { return reply.code(201).send({ data: await dependencies.resourceAdmin.create({ id: randomUUID(), tenantId: request.params.tenantId, name: request.body.name.trim(), resourceType: request.body.resourceType.trim(), capabilities: request.body.capabilities ?? [] }), error: null }); } catch (error) { return reply.code(400).send({ data: null, error: { code: "RESOURCE_INVALID", message: error instanceof Error ? error.message : "Resource could not be created." } }); }
  });
  app.post<{ Params: { tenantId: string; resourceId: string }; Body: { status: "active" | "inactive" } }>("/v1/tenants/:tenantId/resources/:resourceId/status", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId, ["owner", "admin"])) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.resourceAdmin) return reply.code(503).send({ data: null, error: { code: "RESOURCES_UNAVAILABLE", message: "Resources are temporarily unavailable." } });
    if (request.body?.status !== "active" && request.body?.status !== "inactive") return reply.code(400).send({ data: null, error: { code: "RESOURCE_INVALID", message: "Resource status is invalid." } });
    const changed = await dependencies.resourceAdmin.setStatus(request.params.tenantId, request.params.resourceId, request.body.status);
    return changed ? reply.send({ data: { resourceId: request.params.resourceId, status: request.body.status }, error: null }) : reply.code(404).send({ data: null, error: { code: "RESOURCE_INVALID", message: "Resource was not found." } });
  });
  app.get<{ Params: { tenantId: string }; Querystring: { from?: string; to?: string; durationMinutes?: string; stepMinutes?: string; requiredResourceCount?: string } }>("/v1/tenants/:tenantId/availability", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!allowed(context, request.params.tenantId)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.resourceAdmin) return reply.code(503).send({ data: null, error: { code: "AVAILABILITY_UNAVAILABLE", message: "Availability is temporarily unavailable." } });
    const parsed = parseWindow(request.query);
    if (!parsed) return reply.code(400).send({ data: null, error: { code: "AVAILABILITY_INVALID", message: "Availability window parameters are invalid." } });
    return reply.send({ data: serialize(await dependencies.resourceAdmin.availability(request.params.tenantId, parsed.window, parsed.requiredResourceCount)), error: null });
  });
  app.get<{ Params: { publicCode: string }; Querystring: { from?: string; to?: string; durationMinutes?: string; stepMinutes?: string; requiredResourceCount?: string } }>("/v1/public/qr/:publicCode/availability", async (request, reply) => {
    if (!dependencies.qrReader || !dependencies.resourceAdmin) return reply.code(503).send({ data: null, error: { code: "AVAILABILITY_UNAVAILABLE", message: "Availability is temporarily unavailable." } });
    const resolution = await resolveQrDestination(dependencies.qrReader, request.params.publicCode);
    if (!resolution.ok) { const code = resolution.reason === "expired" ? "QR_EXPIRED" : resolution.reason === "inactive" ? "QR_INACTIVE" : "QR_NOT_FOUND"; return reply.code(code === "QR_NOT_FOUND" ? 404 : 410).send({ data: null, error: { code, message: "This booking link is not available." } }); }
    const parsed = parseWindow(request.query);
    if (!parsed) return reply.code(400).send({ data: null, error: { code: "AVAILABILITY_INVALID", message: "Availability window parameters are invalid." } });
    return reply.send({ data: serialize(await dependencies.resourceAdmin.availability(resolution.destination.tenantId, parsed.window, parsed.requiredResourceCount)), error: null });
  });
}
