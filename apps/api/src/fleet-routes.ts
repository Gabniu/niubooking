// Ownership: authenticated staff/driver fleet commands and credential-bound telemetry ingest.

import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { classifyPositionFreshness, type FleetCrewAssignmentStatus, type FleetDevice, type FleetTelemetryObservation, type FleetTrackingSession, type FleetTripAssignment, type TelemetryReceipt, type VehiclePosition } from "@bookingapp/domain";
import { createFleetDeviceCredential, createFleetSessionCredential, type FleetCurrentProjection } from "@bookingapp/database";
import type { DriverPositionUpload, FleetStreamEvent, StaffLiveFleetResponse } from "@bookingapp/contracts";
import type { TenantContextRequest } from "./tenant-context-handler.js";
import type { FleetLiveStream } from "./fleet-live-stream.js";
import { parseOsmAndObservation } from "./fleet-osmand.js";

export interface FleetTrackingAdmin {
  enroll(input: { id: string; tenantId: string; branchId: string; userId?: string | null; vehicleResourceId?: string | null; platform: "android" | "ios" | "hardware"; label: string; credentialSecret: string; actorId?: string }): Promise<FleetDevice>;
  assign(input: { id: string; tenantId: string; branchId: string; tripId: string; userId: string; role: "driver" | "conductor"; actorId?: string }): Promise<FleetTripAssignment>;
  start(input: { id: string; tenantId: string; tripId: string; deviceId: string; driverUserId: string; expiresAt: Date; traccarCredentialSecret: string; actorId?: string }): Promise<FleetTrackingSession>;
  handover(input: { previousSessionId: string; id: string; tenantId: string; tripId: string; deviceId: string; driverUserId: string; expiresAt: Date; traccarCredentialSecret: string; actorId?: string }): Promise<FleetTrackingSession>;
  end(input: { tenantId: string; sessionId: string; actorId?: string; reason: string; driverUserId?: string; allowManage?: boolean }): Promise<FleetTrackingSession>;
  endTrip(input: { tenantId: string; tripId: string; branchIds?: readonly string[]; actorId?: string; reason: string }): Promise<FleetTrackingSession | null>;
  listCurrent(tenantId: string, branchIds?: readonly string[], assignedUserId?: string): Promise<readonly FleetCurrentProjection[]>;
  listAssigned(tenantId: string, userId: string, branchIds?: readonly string[]): Promise<readonly FleetCrewAssignmentStatus[]>;
  readTripBranch(tenantId: string, tripId: string): Promise<string | null>;
  readSessionScope(tenantId: string, sessionId: string): Promise<{ branchId: string; driverUserId: string } | null>;
  ingestCredential(credential: string, position: Omit<VehiclePosition, "deviceId" | "receivedAt">): Promise<{ receipt: TelemetryReceipt; receivedAt: Date } | null>;
  ingestTraccarCredential(credential: string, observation: FleetTelemetryObservation): Promise<{ receipt: TelemetryReceipt; receivedAt: Date } | { kind: "inactive" } | null>;
}

export interface FleetRouteDependencies {
  resolve(request: FastifyRequest<{ Params: { tenantId: string } }>): TenantContextRequest | Promise<TenantContextRequest>;
  fleetTracking?: FleetTrackingAdmin;
  liveStream?: FleetLiveStream;
}

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

const managerRoles = ["owner", "admin", "manager", "dispatcher"];
const viewerRoles = [...managerRoles, "manager", "driver", "conductor"];
function admitted(context: TenantContextRequest, tenantId: string, roles: readonly string[]): boolean { return Boolean(context.identity && context.mappedUserId && context.membership?.tenantId === tenantId && roles.includes(context.membership.role)); }
function branchAllowed(context: TenantContextRequest, branchId: string): boolean { return context.membership?.role === "owner" || context.membership?.branchIds.includes(branchId) === true; }
function bearer(request: FastifyRequest): string | null { const value = request.headers.authorization; return value?.startsWith("Bearer ") && value.length <= 1024 ? value.slice(7).trim() || null : null; }
function text(value: unknown, max = 200): string | null { if (typeof value !== "string") return null; const result = value.trim(); return result.length > 0 && result.length <= max ? result : null; }
function sessionJson(session: FleetTrackingSession) { return { ...session, startedAt: session.startedAt.toISOString(), expiresAt: session.expiresAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null }; }
function startedSessionJson(session: FleetTrackingSession, credential: string) { return { ...sessionJson(session), traccarCredential: credential }; }
function endedTripJson(session: FleetTrackingSession) { return { tripId: session.tripId, status: session.status, endedAt: session.endedAt?.toISOString() ?? null }; }
function crewStatusJson(item: FleetCrewAssignmentStatus) { return { assignmentId: item.assignmentId, branchId: item.branchId, tripId: item.tripId, role: item.role, status: item.status, assignedAt: item.assignedAt.toISOString(), endedAt: item.endedAt?.toISOString() ?? null, activeSession: item.activeSession ? { id: item.activeSession.id, vehicleResourceId: item.activeSession.vehicleResourceId, status: item.activeSession.status, startedAt: item.activeSession.startedAt.toISOString(), expiresAt: item.activeSession.expiresAt.toISOString() } : null }; }
function fleetResponse(positions: readonly FleetCurrentProjection[]): StaffLiveFleetResponse { return { data: positions.map((item) => ({ ...item, capturedAt: item.capturedAt?.toISOString() ?? null, freshness: item.capturedAt ? classifyPositionFreshness(item.capturedAt, new Date()) : "offline", eta: item.eta ? { earliestArrival: item.eta.earliestArrival.toISOString(), latestArrival: item.eta.latestArrival.toISOString(), confidence: item.eta.confidence } : null })), error: null }; }
function streamEvent(type: FleetStreamEvent["type"], version: number, response: StaffLiveFleetResponse): FleetStreamEvent { return { type, version, response }; }

export function registerFleetRoutes(app: FastifyInstance, dependencies: FleetRouteDependencies): void {
  const ingestOsmAnd = async (request: FastifyRequest, reply: FastifyReply): Promise<unknown> => {
    if (!dependencies.fleetTracking) return reply.code(503).send({ data: null, error: { code: "LIVE_FLEET_UNAVAILABLE", message: "Fleet tracking is temporarily unavailable." } });
    const source = { ...record(request.query), ...record(request.body) };
    const parsed = parseOsmAndObservation(source);
    if (parsed.kind === "invalid") return reply.code(400).send({ data: null, error: { code: "POSITION_INVALID", message: parsed.message } });
    try {
      const result = await dependencies.fleetTracking.ingestTraccarCredential(parsed.value.credential, parsed.value.observation);
      if (!result) return reply.code(401).send({ data: null, error: { code: "TRACKING_UNAUTHENTICATED", message: "This tracking device is not connected." } });
      if ("kind" in result) return reply.code(409).send({ data: null, error: { code: "TRACKING_SESSION_INACTIVE", message: "Tracking has stopped for this trip." } });
      if (result.receipt.decision === "reject") return reply.code(400).send({ data: null, error: { code: "POSITION_INVALID", message: "This location update could not be used." } });
      if (result.receipt.decision === "advance_current") dependencies.liveStream?.publish(result.receipt.tenantId, streamEvent("changed", Date.now(), { data: null, error: null }));
      return reply.send({ data: { eventId: result.receipt.eventId, decision: result.receipt.decision, receivedAt: result.receivedAt.toISOString() }, error: null });
    } catch { return reply.code(400).send({ data: null, error: { code: "POSITION_INVALID", message: "This location update could not be used." } }); }
  };
  app.get<{ Querystring: Record<string, unknown> }>("/v1/fleet/telemetry/osmand", ingestOsmAnd);
  app.post<{ Body: Record<string, unknown> }>("/v1/fleet/telemetry/osmand", ingestOsmAnd);

  app.post<{ Params: { tenantId: string }; Body: { branchId: string; userId?: string | null; vehicleResourceId?: string | null; platform: "android" | "ios" | "hardware"; label: string } }>("/v1/tenants/:tenantId/fleet/devices", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!admitted(context, request.params.tenantId, ["owner"])) return reply.code(403).send({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "Only an owner can enroll tracking devices." } });
    if (!dependencies.fleetTracking) return reply.code(503).send({ data: null, error: { code: "LIVE_FLEET_UNAVAILABLE", message: "Fleet tracking is temporarily unavailable." } });
    const body = request.body; const branchId = text(body?.branchId); const label = text(body?.label); const userId = text(body?.userId); const vehicleResourceId = text(body?.vehicleResourceId);
    if (!branchId || !branchAllowed(context, branchId) || !label || !["android", "ios", "hardware"].includes(body?.platform) || (!userId && !vehicleResourceId)) return reply.code(400).send({ data: null, error: { code: "FLEET_DEVICE_INVALID", message: "Choose a branch, driver or vehicle, platform, and device name." } });
    const id = randomUUID(); const secret = randomBytes(32).toString("base64url");
    try { const device = await dependencies.fleetTracking.enroll({ id, tenantId: request.params.tenantId, branchId, userId, vehicleResourceId, platform: body.platform, label, credentialSecret: secret, actorId: context.mappedUserId! }); return reply.code(201).send({ data: { ...device, enrolledAt: device.enrolledAt.toISOString(), revokedAt: null, credential: createFleetDeviceCredential(request.params.tenantId, id, secret) }, error: null }); }
    catch { return reply.code(400).send({ data: null, error: { code: "FLEET_DEVICE_INVALID", message: "That device could not be enrolled. Check the branch, driver, and vehicle." } }); }
  });

  app.post<{ Params: { tenantId: string }; Body: { branchId: string; tripId: string; userId: string; role: "driver" | "conductor" } }>("/v1/tenants/:tenantId/fleet/assignments", async (request, reply) => {
    const context = await dependencies.resolve(request); const body = request.body; const branchId = text(body?.branchId); const tripId = text(body?.tripId); const userId = text(body?.userId);
    if (!admitted(context, request.params.tenantId, managerRoles) || !branchId || !branchAllowed(context, branchId)) return reply.code(403).send({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "You do not have access to assign that trip." } });
    if (!dependencies.fleetTracking) return reply.code(503).send({ data: null, error: { code: "LIVE_FLEET_UNAVAILABLE", message: "Fleet tracking is temporarily unavailable." } });
    if (!tripId || !userId || !["driver", "conductor"].includes(body?.role)) return reply.code(400).send({ data: null, error: { code: "FLEET_ASSIGNMENT_INVALID", message: "Choose a trip, team member, and crew role." } });
    try { const assignment = await dependencies.fleetTracking.assign({ id: randomUUID(), tenantId: request.params.tenantId, branchId, tripId, userId, role: body.role, actorId: context.mappedUserId! }); return reply.code(201).send({ data: assignment, error: null }); }
    catch { return reply.code(400).send({ data: null, error: { code: "FLEET_ASSIGNMENT_INVALID", message: "That crew assignment could not be saved. Check the trip, branch, and team member." } }); }
  });

  app.post<{ Params: { tenantId: string }; Body: { tripId: string; deviceId: string; durationMinutes?: number } }>("/v1/tenants/:tenantId/fleet/tracking-sessions", async (request, reply) => {
    const context = await dependencies.resolve(request); const body = request.body; const tripId = text(body?.tripId); const deviceId = text(body?.deviceId); const duration = body?.durationMinutes ?? 480;
    if (!admitted(context, request.params.tenantId, ["driver"])) return reply.code(403).send({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "Only the assigned driver can start tracking." } });
    if (!dependencies.fleetTracking) return reply.code(503).send({ data: null, error: { code: "LIVE_FLEET_UNAVAILABLE", message: "Fleet tracking is temporarily unavailable." } });
    if (!tripId || !deviceId || !Number.isInteger(duration) || duration < 5 || duration > 1_440) return reply.code(400).send({ data: null, error: { code: "TRACKING_SESSION_INVALID", message: "Choose an assigned trip and enrolled device." } });
    try { const id = randomUUID(); const secret = randomBytes(32).toString("base64url"); const session = await dependencies.fleetTracking.start({ id, tenantId: request.params.tenantId, tripId, deviceId, driverUserId: context.mappedUserId!, expiresAt: new Date(Date.now() + duration * 60_000), traccarCredentialSecret: secret, actorId: context.mappedUserId! }); return reply.code(201).send({ data: startedSessionJson(session, createFleetSessionCredential(request.params.tenantId, id, secret)), error: null }); }
    catch { return reply.code(409).send({ data: null, error: { code: "TRACKING_SESSION_INVALID", message: "Tracking could not start. Check the assigned trip and device, or end the active session first." } }); }
  });

  app.post<{ Params: { tenantId: string; sessionId: string }; Body: { reason?: string } }>("/v1/tenants/:tenantId/fleet/tracking-sessions/:sessionId/end", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!admitted(context, request.params.tenantId, viewerRoles)) return reply.code(403).send({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "You cannot end this tracking session." } });
    if (!dependencies.fleetTracking) return reply.code(503).send({ data: null, error: { code: "LIVE_FLEET_UNAVAILABLE", message: "Fleet tracking is temporarily unavailable." } });
    const scope = await dependencies.fleetTracking.readSessionScope(request.params.tenantId, request.params.sessionId); const canManage = managerRoles.includes(context.membership!.role);
    if (!scope || (!canManage && scope.driverUserId !== context.mappedUserId) || (canManage && !branchAllowed(context, scope.branchId))) return reply.code(403).send({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "You cannot end this tracking session." } });
    try { return reply.send({ data: sessionJson(await dependencies.fleetTracking.end({ tenantId: request.params.tenantId, sessionId: request.params.sessionId, actorId: context.mappedUserId!, driverUserId: context.mappedUserId!, allowManage: canManage, reason: text(request.body?.reason, 200) ?? "stopped" })), error: null }); }
    catch { return reply.code(409).send({ data: null, error: { code: "TRACKING_SESSION_INACTIVE", message: "That tracking session has already ended." } }); }
  });

  app.post<{ Params: { tenantId: string }; Body: { tripId: string; reason?: string } }>("/v1/tenants/:tenantId/fleet/tracking-sessions/end-trip", async (request, reply) => {
    const context = await dependencies.resolve(request); const tripId = text(request.body?.tripId); const canManage = admitted(context, request.params.tenantId, managerRoles);
    if (!canManage) return reply.code(403).send({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "You do not have access to stop tracking for this trip." } });
    if (!dependencies.fleetTracking) return reply.code(503).send({ data: null, error: { code: "LIVE_FLEET_UNAVAILABLE", message: "Fleet tracking is temporarily unavailable." } });
    if (!tripId) return reply.code(400).send({ data: null, error: { code: "TRACKING_SESSION_INVALID", message: "Choose a trip before stopping tracking." } });
    const branchIds = context.membership?.role === "owner" ? undefined : context.membership?.branchIds ?? [];
    try { const session = await dependencies.fleetTracking.endTrip({ tenantId: request.params.tenantId, tripId, ...(branchIds ? { branchIds } : {}), actorId: context.mappedUserId!, reason: text(request.body?.reason, 200) ?? "stopped by workspace staff" }); if (!session) return reply.code(404).send({ data: null, error: { code: "TRACKING_SESSION_INACTIVE", message: "No active tracking session was found for this trip." } }); return reply.send({ data: endedTripJson(session), error: null }); }
    catch { return reply.code(409).send({ data: null, error: { code: "TRACKING_SESSION_INACTIVE", message: "That tracking session has already ended." } }); }
  });

  app.post<{ Params: { tenantId: string; previousSessionId: string }; Body: { tripId: string; deviceId: string; driverUserId: string; durationMinutes?: number } }>("/v1/tenants/:tenantId/fleet/tracking-sessions/:previousSessionId/handover", async (request, reply) => {
    const context = await dependencies.resolve(request); const body = request.body; const tripId = text(body?.tripId); const deviceId = text(body?.deviceId); const driverUserId = text(body?.driverUserId); const duration = body?.durationMinutes ?? 480;
    if (!admitted(context, request.params.tenantId, managerRoles)) return reply.code(403).send({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "You cannot hand over this tracking session." } });
    if (!dependencies.fleetTracking) return reply.code(503).send({ data: null, error: { code: "LIVE_FLEET_UNAVAILABLE", message: "Fleet tracking is temporarily unavailable." } });
    const scope = await dependencies.fleetTracking.readSessionScope(request.params.tenantId, request.params.previousSessionId);
    if (!scope || !branchAllowed(context, scope.branchId) || !tripId || !deviceId || !driverUserId || !Number.isInteger(duration) || duration < 5 || duration > 1_440) return reply.code(403).send({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "You cannot hand over this tracking session." } });
    try { const id = randomUUID(); const secret = randomBytes(32).toString("base64url"); const session = await dependencies.fleetTracking.handover({ previousSessionId: request.params.previousSessionId, id, tenantId: request.params.tenantId, tripId, deviceId, driverUserId, expiresAt: new Date(Date.now() + duration * 60_000), traccarCredentialSecret: secret, actorId: context.mappedUserId! }); return reply.code(201).send({ data: startedSessionJson(session, createFleetSessionCredential(request.params.tenantId, id, secret)), error: null }); }
    catch { return reply.code(409).send({ data: null, error: { code: "TRACKING_SESSION_INVALID", message: "Tracking could not be handed over. Check the active trip and enrolled device." } }); }
  });

  app.get<{ Params: { tenantId: string } }>("/v1/tenants/:tenantId/fleet/my-status", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!admitted(context, request.params.tenantId, ["driver", "conductor"])) return reply.code(403).send({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "You do not have access to your crew assignments." } });
    if (!dependencies.fleetTracking) return reply.code(503).send({ data: null, error: { code: "LIVE_FLEET_UNAVAILABLE", message: "Fleet tracking is temporarily unavailable." } });
    const branchIds = context.membership?.role === "owner" ? undefined : context.membership?.branchIds ?? [];
    const assignments = await dependencies.fleetTracking.listAssigned(request.params.tenantId, context.mappedUserId!, branchIds);
    return reply.send({ data: assignments.map(crewStatusJson), error: null });
  });

  app.get<{ Params: { tenantId: string } }>("/v1/tenants/:tenantId/fleet/current", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!admitted(context, request.params.tenantId, viewerRoles)) return reply.code(403).send({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "You do not have access to live fleet locations." } });
    if (!dependencies.fleetTracking) return reply.code(503).send({ data: null, error: { code: "LIVE_FLEET_UNAVAILABLE", message: "Live fleet locations are temporarily unavailable." } });
    const branchIds = context.membership?.role === "owner" ? undefined : context.membership?.branchIds ?? [];
    const assignedUserId = ["driver", "conductor"].includes(context.membership?.role ?? "") ? context.mappedUserId ?? undefined : undefined;
    const positions = await dependencies.fleetTracking.listCurrent(request.params.tenantId, branchIds, assignedUserId);
    return reply.send(fleetResponse(positions));
  });

  app.get<{ Params: { tenantId: string } }>("/v1/tenants/:tenantId/fleet/stream", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!admitted(context, request.params.tenantId, viewerRoles)) return reply.code(403).send({ data: null, error: { code: "FLEET_ACCESS_DENIED", message: "You do not have access to live fleet locations." } });
    if (!dependencies.fleetTracking || !dependencies.liveStream) return reply.code(503).send({ data: null, error: { code: "LIVE_FLEET_UNAVAILABLE", message: "Live fleet updates are temporarily unavailable." } });
    const branchIds = context.membership?.role === "owner" ? undefined : context.membership?.branchIds ?? [];
    const assignedUserId = ["driver", "conductor"].includes(context.membership?.role ?? "") ? context.mappedUserId ?? undefined : undefined;
    const raw = reply.raw;
    reply.hijack();
    raw.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
    let version = 0;
    let writing = false;
    let queued = false;
    const write = (event: FleetStreamEvent): void => { if (!raw.destroyed) raw.write(`id: ${event.version}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`); };
    const snapshot = async (type: FleetStreamEvent["type"]): Promise<void> => {
      if (writing) { queued = true; return; }
      writing = true;
      try { write(streamEvent(type, ++version, fleetResponse(await dependencies.fleetTracking!.listCurrent(request.params.tenantId, branchIds, assignedUserId)))); }
      finally { writing = false; if (queued && !raw.destroyed) { queued = false; void snapshot("changed"); } }
    };
    const unsubscribe = dependencies.liveStream.subscribe(request.params.tenantId, () => void snapshot("changed"));
    const keepAlive = setInterval(() => { if (!raw.destroyed) raw.write(": keep-alive\n\n"); }, 25_000);
    request.raw.once("close", () => { clearInterval(keepAlive); unsubscribe(); });
    await snapshot("snapshot");
  });

  app.post<{ Body: DriverPositionUpload }>("/v1/fleet/telemetry", async (request, reply) => {
    if (!dependencies.fleetTracking) return reply.code(503).send({ data: null, error: { code: "LIVE_FLEET_UNAVAILABLE", message: "Tracking is temporarily unavailable." } });
    const credential = bearer(request); const body = request.body; const sessionId = text(body?.sessionId); const eventId = text(body?.eventId); const capturedAt = new Date(body?.capturedAt ?? "");
    if (!credential) return reply.code(401).send({ data: null, error: { code: "TRACKING_UNAUTHENTICATED", message: "This tracking device is not connected." } });
    if (!sessionId || !eventId || !Number.isSafeInteger(body?.sequence) || Number.isNaN(capturedAt.getTime())) return reply.code(400).send({ data: null, error: { code: "POSITION_INVALID", message: "This location update is incomplete." } });
    try {
      const result = await dependencies.fleetTracking.ingestCredential(credential, { ...body, sessionId, eventId, capturedAt });
      if (!result) return reply.code(401).send({ data: null, error: { code: "TRACKING_UNAUTHENTICATED", message: "This tracking device is not connected." } });
      if (result.receipt.decision === "reject") { const inactive = result.receipt.reasons.some((reason) => /session/iu.test(reason)); return reply.code(inactive ? 409 : 400).send({ data: null, error: { code: inactive ? "TRACKING_SESSION_INACTIVE" : "POSITION_INVALID", message: inactive ? "Tracking has stopped for this trip." : "This location update could not be used." } }); }
      if (result.receipt.decision === "advance_current") dependencies.liveStream?.publish(result.receipt.tenantId, streamEvent("changed", Date.now(), { data: null, error: null }));
      return reply.code(202).send({ data: { eventId: result.receipt.eventId, decision: result.receipt.decision, receivedAt: result.receivedAt.toISOString() }, error: null });
    } catch { return reply.code(400).send({ data: null, error: { code: "POSITION_INVALID", message: "This location update could not be used." } }); }
  });
}
