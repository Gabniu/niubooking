import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify"; import { randomBytes } from "node:crypto";
import { resolveQrDestination, validateFeedbackAnswers, validateFeedbackCampaign, validateFeedbackTemplate, type BookingChangePolicy, type BookingStatus, type CommunicationChannel, type CustomerStatus, type FeedbackTemplate, type QrDestinationReader } from "@bookingapp/domain";
import { authorizedWorkspacesFailure, authorizedWorkspacesSuccess, publicQrFailure, publicQrSuccess, type FeedbackCampaignDraft, type FeedbackTemplateDraft } from "@bookingapp/contracts"; import { getTenantContext, type TenantContextRequest } from "./tenant-context-handler.js"; import { registerResourceRoutes } from "./resource-routes.js"; import { registerServiceRoutes } from "./service-routes.js"; import { registerServiceCompositionRoutes } from "./service-composition-routes.js"; import { registerRequirementAvailabilityRoutes } from "./requirement-availability-routes.js"; import { registerIndustryPackRoutes } from "./industry-pack-routes.js"; import { registerIndustryPackSettingsRoutes } from "./industry-pack-settings-routes.js"; import { registerManageBookingRoutes, type ManageBooking } from "./manage-booking-routes.js"; import { registerOccurrenceRoutes } from "./occurrence-routes.js";
import { registerHealthRoutes } from "./health-routes.js"; import { registerAuthRoutes, type AuthRouteDependencies } from "./auth-routes.js";
export interface IdentityContextRequest { identity: TenantContextRequest["identity"]; mappedUserId: string | null; } export interface TenantContextDependencies { auth?: AuthRouteDependencies; resolve(request: FastifyRequest<{ Params: { tenantId: string } }>): TenantContextRequest | Promise<TenantContextRequest>; resolveIdentity?(request: FastifyRequest): IdentityContextRequest | Promise<IdentityContextRequest>; workspaceReader?: { list(userId: string): Promise<readonly { tenantId: string; branchIds: readonly string[]; role: string }[]> };
  qrReader?: QrDestinationReader;
  qrAdmin?: {
    list(tenantId: string): Promise<readonly unknown[]>;
    create(input: { publicCode: string; tenantId: string; branchId: string | null; packId: string | null; serviceId: string | null; campaign: string | null; expiresAt: Date | null }): Promise<unknown>;
    setStatus(tenantId: string, publicCode: string, status: "paused" | "revoked" | "active"): Promise<boolean>; rotate?(tenantId: string, publicCode: string, replacementCode: string): Promise<unknown | null>;
  };
  communicationAdmin?: {
    read(tenantId: string): Promise<unknown | null>;
    save(settings: { tenantId: string; timezone: string; remindersEnabled: boolean; feedbackEnabled: boolean; defaultFeedbackFrequencyDays: number; reminderRules: readonly unknown[]; bookingChangePolicy: BookingChangePolicy }): Promise<void>;
  };
  contactAdmin?: {
    list(tenantId: string): Promise<readonly unknown[]>;
    upsert(input: { id: string; tenantId: string; customerId: string; channel: CommunicationChannel; destination: string; consentStatus: "granted" | "denied" | "unknown"; verifiedAt: Date | null }): Promise<void>;
    issueChallenge?(input: { tenantId: string; contactMethodId: string }): Promise<{ challengeId: string; expiresAt: Date }>;
  };
  contactVerification?: { verify(challengeId: string, code: string): Promise<"verified" | "invalid" | "expired" | "locked" | "not_found">; };
  customerAdmin?: {
    list(tenantId: string, includeArchived?: boolean): Promise<readonly unknown[]>;
    read(tenantId: string, customerId: string): Promise<unknown | null>;
    create(input: { id: string; tenantId: string; displayName: string; preferredLocale: string | null; timezone: string | null }): Promise<unknown>;
    update(input: { tenantId: string; customerId: string; displayName: string; preferredLocale: string | null; timezone: string | null }): Promise<unknown | null>;
    setStatus(tenantId: string, customerId: string, status: CustomerStatus): Promise<boolean>;
  };
  bookingAdmin?: {
    list(tenantId: string, from?: Date, to?: Date): Promise<readonly unknown[]>;
    create(input: { id: string; tenantId: string; customerId: string; serviceName: string; startsAt: Date; endsAt: Date; resourceIds?: readonly string[] }): Promise<unknown>;
    setStatus(tenantId: string, bookingId: string, status: BookingStatus): Promise<unknown | null>;
  };
  bookingPublic?: {
    createHold(input: { tenantId: string; publicCode: string; customerName: string; serviceName: string; startsAt: Date; endsAt: Date; idempotencyKey: string; resourceIds?: readonly string[]; variantId?: string | null; requirementAssignments?: readonly { requirementId: string; resourceIds: readonly string[] }[] }): Promise<{ holdId: string; holdToken: string; serviceName: string; startsAt: Date; endsAt: Date; expiresAt: Date; resourceIds?: readonly string[]; requirementAssignments?: readonly { requirementId: string; resourceIds: readonly string[] }[] }>;
    confirmHold(input: { tenantId: string; publicCode: string; holdId: string; holdToken: string; idempotencyKey: string; contact?: { channel: CommunicationChannel; destination: string; consentGranted: boolean } }): Promise<unknown | null>;
  };
  bookingManage?: { read(token: string): Promise<ManageBooking | null>; reschedule(token: string, startsAt: Date, endsAt: Date, idempotencyKey: string): Promise<ManageBooking | null>; cancel(token: string, idempotencyKey: string): Promise<ManageBooking | null> };
  feedbackPublic?: {
    read(capabilityId: string): Promise<{ capabilityId: string; campaignId: string; templateVersion: number; expiresAt: Date; usedAt: Date | null; template: FeedbackTemplate | null } | null>;
    submit(input: { capabilityId: string; campaignId: string; templateVersion: number; customerId: string; answers: Readonly<Record<string, string | number>> }): Promise<boolean>;
  };
  feedbackAdmin?: { listCampaigns(tenantId: string): Promise<readonly unknown[]>; createTemplate(input: FeedbackTemplateDraft & { tenantId: string }): Promise<unknown>; createCampaign?(input: FeedbackCampaignDraft & { tenantId: string }): Promise<unknown>; setCampaignStatus?(tenantId: string, campaignId: string, enabled: boolean): Promise<boolean> };
  feedbackReporting?: { listResponses(tenantId: string, campaignId?: string): Promise<readonly unknown[]>; analytics(tenantId: string, campaignId: string, templateVersion?: number): Promise<unknown | null> };
  resourceAdmin?: { list(tenantId: string): Promise<readonly unknown[]>; create(input: { id: string; tenantId: string; name: string; resourceType: string; capabilities?: readonly string[] }): Promise<unknown>; setStatus(tenantId: string, resourceId: string, status: "active" | "inactive"): Promise<boolean>; availability(tenantId: string, window: import("@bookingapp/domain").AvailabilityWindow, requiredResourceCount?: number): Promise<readonly { startsAt: Date; endsAt: Date; resourceIds: readonly string[] }[]> }; serviceAdmin?: import("./service-routes.js").ServiceRouteDependencies["serviceAdmin"]; compositionAdmin?: import("./service-composition-routes.js").ServiceCompositionRouteDependencies["compositionAdmin"]; requirementAvailabilityAdmin?: import("./requirement-availability-routes.js").RequirementAvailabilityRouteDependencies["requirementAvailabilityAdmin"]; packAdmin?: import("./industry-pack-settings-routes.js").IndustryPackSettingsRouteDependencies["packAdmin"];
  occurrenceAdmin?: { list(tenantId: string, from?: Date, to?: Date): Promise<readonly unknown[]>; create(input: import("@bookingapp/domain").ServiceOccurrenceDraft): Promise<unknown>; reserve(input: import("@bookingapp/domain").ReservationDraft): Promise<unknown>; listReservations?(tenantId: string, occurrenceId: string): Promise<readonly unknown[]>; setReservationStatus?(input: { tenantId: string; occurrenceId: string; reservationId: string; status: import("@bookingapp/domain").ReservationStatus; actorId?: string }): Promise<unknown>; reservePublic?(input: import("@bookingapp/database").PublicOccurrenceReservationInput): Promise<import("@bookingapp/domain").Reservation> };
  health?: { check(): Promise<boolean> }; }
function responseStatus(code: string | undefined): number { return code === "UNAUTHENTICATED" ? 401 : code === "TENANT_ACCESS_DENIED" ? 403 : 200; } export function createApiServer(dependencies: TenantContextDependencies): FastifyInstance {
  const app = Fastify({ logger: false }); registerHealthRoutes(app, dependencies.health); registerAuthRoutes(app, dependencies.auth);
  app.get("/v1/workspaces", async (request, reply) => { const context = dependencies.resolveIdentity ? await dependencies.resolveIdentity(request) : { identity: null, mappedUserId: null }; if (!context.identity || !context.mappedUserId) return reply.code(401).send(authorizedWorkspacesFailure("UNAUTHENTICATED")); if (!dependencies.workspaceReader) return reply.code(503).send(authorizedWorkspacesFailure("WORKSPACES_UNAVAILABLE")); try { const memberships = await dependencies.workspaceReader.list(context.mappedUserId); return reply.send(authorizedWorkspacesSuccess(memberships.map(({ tenantId, branchIds, role }) => ({ tenantId, branchIds: [...branchIds], role })))); } catch { return reply.code(503).send(authorizedWorkspacesFailure("WORKSPACES_UNAVAILABLE")); } });
  app.get<{ Params: { tenantId: string } }>("/v1/tenant-context/:tenantId", async (request, reply) => {
    const response = getTenantContext(await dependencies.resolve(request));
    return reply.code(responseStatus(response.error?.code)).send(response);
  });
  app.get<{ Params: { publicCode: string } }>("/v1/public/qr/:publicCode", async (request, reply) => {
    if (!dependencies.qrReader) return reply.code(503).send(publicQrFailure("QR_NOT_FOUND"));
    const result = await resolveQrDestination(dependencies.qrReader, request.params.publicCode);
    if (!result.ok) {
      const code = result.reason === "expired" ? "QR_EXPIRED" : result.reason === "inactive" ? "QR_INACTIVE" : "QR_NOT_FOUND";
      return reply.code(result.reason === "not_found" ? 404 : 410).send(publicQrFailure(code));
    }
    const { destination } = result;
    return reply.send(publicQrSuccess({ publicCode: destination.publicCode, tenantId: destination.tenantId, branchId: destination.branchId, packId: destination.packId, serviceId: destination.serviceId, campaign: destination.campaign }));
  });
  app.post<{ Params: { publicCode: string }; Body: { customerName: string; serviceName: string; startsAt: string; endsAt: string; idempotencyKey: string; variantId?: string | null; resourceIds?: string[]; requirementAssignments?: { requirementId: string; resourceIds: string[] }[] } }>("/v1/public/qr/:publicCode/booking-holds", async (request, reply) => {
    if (!dependencies.bookingPublic) return reply.code(503).send({ data: null, error: { code: "BOOKINGS_UNAVAILABLE", message: "Public booking is temporarily unavailable." } });
    const resolution = await resolveQrDestination(dependencies.qrReader ?? { findByPublicCode: async () => null }, request.params.publicCode);
    if (!resolution.ok) { const code = resolution.reason === "expired" ? "QR_EXPIRED" : resolution.reason === "inactive" ? "QR_INACTIVE" : "QR_NOT_FOUND"; return reply.code(code === "QR_NOT_FOUND" ? 404 : 410).send({ data: null, error: { code, message: code === "QR_EXPIRED" ? "This booking link has expired." : code === "QR_INACTIVE" ? "This booking link is temporarily unavailable." : "This booking link is not available." } }); }
    const body = request.body;
    const startsAt = new Date(body?.startsAt ?? "");
    const endsAt = new Date(body?.endsAt ?? "");
    const assignmentsValid = body?.requirementAssignments === undefined || (Array.isArray(body.requirementAssignments) && body.requirementAssignments.length <= 32 && body.requirementAssignments.every((assignment) => assignment && typeof assignment.requirementId === "string" && assignment.requirementId.trim().length > 0 && Array.isArray(assignment.resourceIds) && assignment.resourceIds.length <= 16 && assignment.resourceIds.every((id) => typeof id === "string" && id.trim().length > 0)));
    if (!body?.customerName?.trim() || body.customerName.trim().length > 200 || !body.serviceName?.trim() || body.serviceName.trim().length > 200 || !body.idempotencyKey?.trim() || body.idempotencyKey.length > 200 || (body.variantId !== undefined && body.variantId !== null && (typeof body.variantId !== "string" || body.variantId.trim().length > 120)) || (body.resourceIds !== undefined && (!Array.isArray(body.resourceIds) || body.resourceIds.length > 16 || body.resourceIds.some((id) => typeof id !== "string"))) || !assignmentsValid || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return reply.code(400).send({ data: null, error: { code: "BOOKING_INVALID", message: "Name, service, resource selection, assignments, idempotency key, and ordered booking times are required." } });
    try {
      const hold = await dependencies.bookingPublic.createHold({ tenantId: resolution.destination.tenantId, publicCode: resolution.destination.publicCode, customerName: body.customerName.trim(), serviceName: body.serviceName.trim(), startsAt, endsAt, idempotencyKey: body.idempotencyKey.trim(), ...(body.variantId ? { variantId: body.variantId.trim() } : {}), ...(body.resourceIds ? { resourceIds: body.resourceIds } : {}), ...(body.requirementAssignments ? { requirementAssignments: body.requirementAssignments.map((assignment) => ({ requirementId: assignment.requirementId.trim(), resourceIds: assignment.resourceIds.map((id) => id.trim()) })) } : {}) });
      return reply.code(201).send({ data: { holdId: hold.holdId, holdToken: hold.holdToken, serviceName: hold.serviceName, startsAt: hold.startsAt.toISOString(), endsAt: hold.endsAt.toISOString(), expiresAt: hold.expiresAt.toISOString(), ...(hold.resourceIds?.length ? { resourceIds: hold.resourceIds } : {}), ...(hold.requirementAssignments?.length ? { requirementAssignments: hold.requirementAssignments } : {}) }, error: null });
    } catch (error) { return reply.code(409).send({ data: null, error: { code: "BOOKING_INVALID", message: error instanceof Error ? error.message : "That time is no longer available." } }); }
  });
  app.post<{ Params: { publicCode: string; holdId: string }; Body: { holdToken: string; idempotencyKey: string; contact?: { channel: CommunicationChannel; destination: string; consentGranted?: boolean } } }>("/v1/public/qr/:publicCode/booking-holds/:holdId/confirm", async (request, reply) => {
    if (!dependencies.bookingPublic) return reply.code(503).send({ data: null, error: { code: "BOOKINGS_UNAVAILABLE", message: "Public booking is temporarily unavailable." } });
    const resolution = await resolveQrDestination(dependencies.qrReader ?? { findByPublicCode: async () => null }, request.params.publicCode);
    if (!resolution.ok) { const code = resolution.reason === "expired" ? "QR_EXPIRED" : resolution.reason === "inactive" ? "QR_INACTIVE" : "QR_NOT_FOUND"; return reply.code(code === "QR_NOT_FOUND" ? 404 : 410).send({ data: null, error: { code, message: code === "QR_EXPIRED" ? "This booking link has expired." : code === "QR_INACTIVE" ? "This booking link is temporarily unavailable." : "This booking link is not available." } }); }
    const body = request.body;
    if (!body?.holdToken?.trim() || !body.idempotencyKey?.trim() || body.idempotencyKey.length > 200) return reply.code(400).send({ data: null, error: { code: "BOOKING_HOLD_INVALID", message: "A valid hold token and idempotency key are required." } });
    const contact = body.contact;
    if (contact && (!['email', 'sms', 'voice'].includes(contact.channel) || !contact.destination?.trim() || contact.destination.trim() !== contact.destination || contact.destination.length > 320 || /[\u0000-\u001F\u007F]/.test(contact.destination))) return reply.code(400).send({ data: null, error: { code: "BOOKING_INVALID", message: "Contact details are invalid." } });
    try { const booking = await dependencies.bookingPublic.confirmHold({ tenantId: resolution.destination.tenantId, publicCode: resolution.destination.publicCode, holdId: request.params.holdId, holdToken: body.holdToken, idempotencyKey: body.idempotencyKey, ...(contact ? { contact: { channel: contact.channel, destination: contact.destination.trim(), consentGranted: contact.consentGranted === true } } : {}) }); return booking ? reply.code(201).send({ data: booking, error: null }) : reply.code(409).send({ data: null, error: { code: "BOOKING_HOLD_EXPIRED", message: "This booking hold is no longer available." } }); } catch (error) { return reply.code(409).send({ data: null, error: { code: "BOOKING_INVALID", message: error instanceof Error ? error.message : "That time is no longer available." } });
    }
  });
  app.post<{ Params: { tenantId: string }; Body: { branchId?: string | null; packId?: string | null; serviceId?: string | null; campaign?: string | null; expiresAt?: string | null } }>("/v1/tenants/:tenantId/qr-destinations", async (request, reply) => {
    const context = await dependencies.resolve(request);
      if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
      if (!dependencies.qrAdmin) return reply.code(503).send({ data: null, error: { code: "QR_ADMIN_UNAVAILABLE", message: "QR management is temporarily unavailable." } });
      const body = request.body ?? {};
      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null; const rawFields = [body.branchId, body.packId, body.serviceId, body.campaign]; const textFields = rawFields.filter((value): value is string => typeof value === "string");
      if (rawFields.some((value) => value !== undefined && value !== null && typeof value !== "string") || textFields.some((value) => value.trim().length > 120) || (expiresAt && Number.isNaN(expiresAt.getTime())) || (expiresAt && expiresAt <= new Date())) return reply.code(400).send({ data: null, error: { code: "QR_INVALID", message: "QR destination details or expiry are invalid." } });
      const destination = await dependencies.qrAdmin.create({ publicCode: randomBytes(18).toString("base64url"), tenantId: request.params.tenantId, branchId: body.branchId?.trim() || null, packId: body.packId?.trim() || null, serviceId: body.serviceId?.trim() || null, campaign: body.campaign?.trim() || null, expiresAt }); return reply.code(201).send({ data: destination, error: null });
  });
  app.get<{ Params: { tenantId: string } }>("/v1/tenants/:tenantId/qr-destinations", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.qrAdmin) return reply.code(503).send({ data: null, error: { code: "QR_ADMIN_UNAVAILABLE", message: "QR management is temporarily unavailable." } });
    return reply.send({ data: await dependencies.qrAdmin.list(request.params.tenantId), error: null });
  });
  app.post<{ Params: { tenantId: string; publicCode: string }; Body: { status: "paused" | "revoked" | "active" } }>("/v1/tenants/:tenantId/qr-destinations/:publicCode/status", async (request, reply) => {
    const context = await dependencies.resolve(request);
      if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
      if (!dependencies.qrAdmin) return reply.code(503).send({ data: null, error: { code: "QR_ADMIN_UNAVAILABLE", message: "QR management is temporarily unavailable." } }); if (!["active", "paused", "revoked"].includes(request.body?.status)) return reply.code(400).send({ data: null, error: { code: "QR_INVALID", message: "Choose a valid QR destination status." } });
      const changed = await dependencies.qrAdmin.setStatus(request.params.tenantId, request.params.publicCode, request.body.status);
    return changed ? reply.send({ data: { publicCode: request.params.publicCode, status: request.body.status }, error: null }) : reply.code(404).send({ data: null, error: { code: "QR_NOT_FOUND", message: "This booking link is not available." } });
  }); app.post<{ Params: { tenantId: string; publicCode: string } }>("/v1/tenants/:tenantId/qr-destinations/:publicCode/rotate", async (request, reply) => { const context = await dependencies.resolve(request); if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } }); if (!dependencies.qrAdmin?.rotate) return reply.code(503).send({ data: null, error: { code: "QR_ADMIN_UNAVAILABLE", message: "QR management is temporarily unavailable." } }); const destination = await dependencies.qrAdmin.rotate(request.params.tenantId, request.params.publicCode, randomBytes(18).toString("base64url")); return destination ? reply.code(201).send({ data: destination, error: null }) : reply.code(404).send({ data: null, error: { code: "QR_NOT_FOUND", message: "This booking link is not available." } }); });
  app.get<{ Params: { tenantId: string } }>("/v1/tenants/:tenantId/communication-settings", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.communicationAdmin) return reply.code(503).send({ data: null, error: { code: "COMMUNICATIONS_UNAVAILABLE", message: "Communication settings are temporarily unavailable." } });
    return reply.send({ data: await dependencies.communicationAdmin.read(request.params.tenantId), error: null });
  });
  app.put<{ Params: { tenantId: string }; Body: { timezone: string; remindersEnabled: boolean; feedbackEnabled: boolean; defaultFeedbackFrequencyDays: number; reminderRules: readonly unknown[]; bookingChangePolicy: BookingChangePolicy } }>("/v1/tenants/:tenantId/communication-settings", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.communicationAdmin) return reply.code(503).send({ data: null, error: { code: "COMMUNICATIONS_UNAVAILABLE", message: "Communication settings are temporarily unavailable." } });
    const policy = request.body.bookingChangePolicy;
    if (!request.body.timezone || request.body.defaultFeedbackFrequencyDays <= 0 || !policy || typeof policy.rescheduleEnabled !== "boolean" || typeof policy.cancellationEnabled !== "boolean" || !Number.isInteger(policy.minimumNoticeMinutes) || policy.minimumNoticeMinutes < 0 || policy.minimumNoticeMinutes > 43_200) return reply.code(400).send({ data: null, error: { code: "INVALID_SETTINGS", message: "Communication settings are invalid." } });
    await dependencies.communicationAdmin.save({ ...request.body, tenantId: request.params.tenantId });
    return reply.code(204).send();
  });
  app.get<{ Params: { tenantId: string } }>("/v1/tenants/:tenantId/contact-methods", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.contactAdmin) return reply.code(503).send({ data: null, error: { code: "CONTACTS_UNAVAILABLE", message: "Contact methods are temporarily unavailable." } });
    return reply.send({ data: await dependencies.contactAdmin.list(request.params.tenantId), error: null });
  });
  app.post<{ Params: { tenantId: string }; Body: { customerId: string; channel: CommunicationChannel; destination: string; consentStatus: "granted" | "denied" | "unknown" } }>("/v1/tenants/:tenantId/contact-methods", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.contactAdmin) return reply.code(503).send({ data: null, error: { code: "CONTACTS_UNAVAILABLE", message: "Contact methods are temporarily unavailable." } });
    const body = request.body;
    if (!body || !body.customerId?.trim() || !["email", "sms", "voice"].includes(body.channel) || !body.destination?.trim() || !["granted", "denied", "unknown"].includes(body.consentStatus)) return reply.code(400).send({ data: null, error: { code: "CONTACT_INVALID", message: "Contact method details are invalid." } });
    await dependencies.contactAdmin.upsert({ id: randomBytes(18).toString("base64url"), tenantId: request.params.tenantId, customerId: body.customerId.trim(), channel: body.channel, destination: body.destination.trim(), consentStatus: body.consentStatus, verifiedAt: null });
    return reply.code(204).send();
  });
  app.get<{ Params: { tenantId: string }; Querystring: { includeArchived?: string } }>("/v1/tenants/:tenantId/customers", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.customerAdmin) return reply.code(503).send({ data: null, error: { code: "CUSTOMERS_UNAVAILABLE", message: "Customers are temporarily unavailable." } });
    return reply.send({ data: await dependencies.customerAdmin.list(request.params.tenantId, request.query.includeArchived === "true"), error: null });
  });
  app.get<{ Params: { tenantId: string; customerId: string } }>("/v1/tenants/:tenantId/customers/:customerId", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.customerAdmin) return reply.code(503).send({ data: null, error: { code: "CUSTOMERS_UNAVAILABLE", message: "Customers are temporarily unavailable." } });
    const customer = await dependencies.customerAdmin.read(request.params.tenantId, request.params.customerId);
    return customer ? reply.send({ data: customer, error: null }) : reply.code(404).send({ data: null, error: { code: "CUSTOMER_NOT_FOUND", message: "This customer was not found." } });
  });
  app.post<{ Params: { tenantId: string }; Body: { displayName: string; preferredLocale?: string | null; timezone?: string | null } }>("/v1/tenants/:tenantId/customers", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.customerAdmin) return reply.code(503).send({ data: null, error: { code: "CUSTOMERS_UNAVAILABLE", message: "Customers are temporarily unavailable." } });
    const body = request.body;
    if (!body || typeof body.displayName !== "string" || body.displayName.trim().length < 1 || body.displayName.trim().length > 200) return reply.code(400).send({ data: null, error: { code: "CUSTOMER_INVALID", message: "Customer name must be between 1 and 200 characters." } });
    const customer = await dependencies.customerAdmin.create({ id: randomBytes(18).toString("base64url"), tenantId: request.params.tenantId, displayName: body.displayName.trim(), preferredLocale: body.preferredLocale ?? null, timezone: body.timezone ?? null });
    return reply.code(201).send({ data: customer, error: null });
  });
  app.post<{ Params: { tenantId: string; customerId: string }; Body: { status: CustomerStatus } }>("/v1/tenants/:tenantId/customers/:customerId/status", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.customerAdmin) return reply.code(503).send({ data: null, error: { code: "CUSTOMERS_UNAVAILABLE", message: "Customers are temporarily unavailable." } });
    if (request.body?.status !== "active" && request.body?.status !== "archived") return reply.code(400).send({ data: null, error: { code: "CUSTOMER_INVALID", message: "Customer status is invalid." } });
    const changed = await dependencies.customerAdmin.setStatus(request.params.tenantId, request.params.customerId, request.body.status);
    return changed ? reply.send({ data: { customerId: request.params.customerId, status: request.body.status }, error: null }) : reply.code(404).send({ data: null, error: { code: "CUSTOMER_NOT_FOUND", message: "This customer was not found." } });
  });
  app.put<{ Params: { tenantId: string; customerId: string }; Body: { displayName: string; preferredLocale?: string | null; timezone?: string | null } }>("/v1/tenants/:tenantId/customers/:customerId", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.customerAdmin) return reply.code(503).send({ data: null, error: { code: "CUSTOMERS_UNAVAILABLE", message: "Customers are temporarily unavailable." } });
    const body = request.body;
    if (!body || typeof body.displayName !== "string" || body.displayName.trim().length < 1 || body.displayName.trim().length > 200) return reply.code(400).send({ data: null, error: { code: "CUSTOMER_INVALID", message: "Customer name must be between 1 and 200 characters." } });
    const customer = await dependencies.customerAdmin.update({ tenantId: request.params.tenantId, customerId: request.params.customerId, displayName: body.displayName.trim(), preferredLocale: body.preferredLocale ?? null, timezone: body.timezone ?? null });
    return customer ? reply.send({ data: customer, error: null }) : reply.code(404).send({ data: null, error: { code: "CUSTOMER_NOT_FOUND", message: "This customer was not found." } });
  });
  app.get<{ Params: { tenantId: string }; Querystring: { from?: string; to?: string } }>("/v1/tenants/:tenantId/bookings", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.bookingAdmin) return reply.code(503).send({ data: null, error: { code: "BOOKINGS_UNAVAILABLE", message: "Bookings are temporarily unavailable." } });
    const from = request.query.from ? new Date(request.query.from) : undefined;
    const to = request.query.to ? new Date(request.query.to) : undefined;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) return reply.code(400).send({ data: null, error: { code: "BOOKING_INVALID", message: "Booking window dates are invalid." } });
    return reply.send({ data: await dependencies.bookingAdmin.list(request.params.tenantId, from, to), error: null });
  });
  app.post<{ Params: { tenantId: string }; Body: { customerId: string; serviceName: string; startsAt: string; endsAt: string; resourceIds?: readonly string[] } }>("/v1/tenants/:tenantId/bookings", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.bookingAdmin) return reply.code(503).send({ data: null, error: { code: "BOOKINGS_UNAVAILABLE", message: "Bookings are temporarily unavailable." } });
    const body = request.body;
    const startsAt = new Date(body?.startsAt ?? "");
    const endsAt = new Date(body?.endsAt ?? "");
    if (!body?.customerId?.trim() || !body.serviceName?.trim() || (body.resourceIds !== undefined && (!Array.isArray(body.resourceIds) || body.resourceIds.length > 16 || body.resourceIds.some((id) => typeof id !== "string"))) || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return reply.code(400).send({ data: null, error: { code: "BOOKING_INVALID", message: "Customer, service, resources, and ordered booking times are required." } });
    try {
      const booking = await dependencies.bookingAdmin.create({ id: randomBytes(18).toString("base64url"), tenantId: request.params.tenantId, customerId: body.customerId.trim(), serviceName: body.serviceName.trim(), startsAt, endsAt, ...(body.resourceIds ? { resourceIds: body.resourceIds.map((id) => id.trim()) } : {}) });
      return reply.code(201).send({ data: booking, error: null });
    } catch (error) { return reply.code(400).send({ data: null, error: { code: "BOOKING_INVALID", message: error instanceof Error ? error.message : "Booking could not be created." } }); }
  });
  app.post<{ Params: { tenantId: string; bookingId: string }; Body: { status: BookingStatus } }>("/v1/tenants/:tenantId/bookings/:bookingId/status", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.bookingAdmin) return reply.code(503).send({ data: null, error: { code: "BOOKINGS_UNAVAILABLE", message: "Bookings are temporarily unavailable." } });
    if (!request.body || !["scheduled", "cancelled", "completed"].includes(request.body.status)) return reply.code(400).send({ data: null, error: { code: "BOOKING_INVALID", message: "Booking status is invalid." } });
    const booking = await dependencies.bookingAdmin.setStatus(request.params.tenantId, request.params.bookingId, request.body.status);
    return booking ? reply.send({ data: booking, error: null }) : reply.code(404).send({ data: null, error: { code: "BOOKING_NOT_FOUND", message: "This booking was not found." } });
  });
  app.post<{ Params: { tenantId: string; contactMethodId: string } }>("/v1/tenants/:tenantId/contact-methods/:contactMethodId/verification-challenge", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.contactAdmin?.issueChallenge) return reply.code(503).send({ data: null, error: { code: "CONTACTS_UNAVAILABLE", message: "Contact verification is temporarily unavailable." } });
    const issueChallenge = dependencies.contactAdmin.issueChallenge;
    const challenge = await issueChallenge({ tenantId: request.params.tenantId, contactMethodId: request.params.contactMethodId });
    return reply.code(201).send({ data: { challengeId: challenge.challengeId, expiresAt: challenge.expiresAt.toISOString() }, error: null });
  });
  app.post<{ Params: { challengeId: string }; Body: { code: string } }>("/v1/public/contact-verification/:challengeId", async (request, reply) => {
    if (!dependencies.contactVerification) return reply.code(503).send({ data: null, error: { code: "CONTACTS_UNAVAILABLE", message: "Contact verification is temporarily unavailable." } });
    const code = request.body?.code;
    if (!/^\d{6}$/.test(code ?? "")) return reply.code(400).send({ data: null, error: { code: "CONTACT_VERIFICATION_INVALID", message: "Enter the six-digit verification code." } });
    const result = await dependencies.contactVerification.verify(request.params.challengeId, code);
    if (result === "verified") return reply.send({ data: { verified: true }, error: null });
    if (result === "expired") return reply.code(410).send({ data: null, error: { code: "CONTACT_VERIFICATION_EXPIRED", message: "This verification code has expired." } });
    if (result === "locked") return reply.code(429).send({ data: null, error: { code: "CONTACT_VERIFICATION_LOCKED", message: "This verification attempt is no longer available." } });
    return reply.code(400).send({ data: null, error: { code: "CONTACT_VERIFICATION_INVALID", message: "That verification code is not valid." } });
  });
  app.get<{ Params: { capabilityId: string } }>("/v1/public/feedback/:capabilityId", async (request, reply) => {
    if (!dependencies.feedbackPublic) return reply.code(503).send({ data: null, error: { code: "FEEDBACK_NOT_FOUND", message: "This feedback link is not available." } });
    const value = await dependencies.feedbackPublic.read(request.params.capabilityId);
    if (!value) return reply.code(404).send({ data: null, error: { code: "FEEDBACK_NOT_FOUND", message: "This feedback link is not available." } });
    if (value.usedAt) return reply.code(410).send({ data: null, error: { code: "FEEDBACK_USED", message: "This feedback link has already been used." } });
    if (value.expiresAt.getTime() <= Date.now()) return reply.code(410).send({ data: null, error: { code: "FEEDBACK_EXPIRED", message: "This feedback link has expired." } });
    if (!value.template || value.template.campaignId !== value.campaignId || value.template.version !== value.templateVersion) return reply.code(404).send({ data: null, error: { code: "FEEDBACK_NOT_FOUND", message: "This feedback link is not available." } });
    return reply.send({ data: { capabilityId: value.capabilityId, campaignId: value.campaignId, title: value.template.title, intro: value.template.intro, templateVersion: value.templateVersion, presentation: value.template.presentation, questionsPerStep: value.template.questionsPerStep, questions: value.template.questions }, error: null });
  });
  app.post<{ Params: { capabilityId: string }; Body: { answers: Readonly<Record<string, string | number>> } }>("/v1/public/feedback/:capabilityId", async (request, reply) => {
    if (!dependencies.feedbackPublic) return reply.code(503).send({ data: null, error: { code: "FEEDBACK_NOT_FOUND", message: "This feedback link is not available." } });
    const value = await dependencies.feedbackPublic.read(request.params.capabilityId);
    if (!value) return reply.code(404).send({ data: null, error: { code: "FEEDBACK_NOT_FOUND", message: "This feedback link is not available." } });
    if (value.usedAt) return reply.code(410).send({ data: null, error: { code: "FEEDBACK_USED", message: "This feedback link has already been used." } });
    if (value.expiresAt.getTime() <= Date.now()) return reply.code(410).send({ data: null, error: { code: "FEEDBACK_EXPIRED", message: "This feedback link has expired." } });
    if (!value.template || value.template.campaignId !== value.campaignId || value.template.version !== value.templateVersion) return reply.code(404).send({ data: null, error: { code: "FEEDBACK_NOT_FOUND", message: "This feedback link is not available." } });
    const answers = request.body?.answers;
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) return reply.code(400).send({ data: null, error: { code: "FEEDBACK_INVALID", message: "Feedback answers must be an object." } });
    const errors = validateFeedbackAnswers(value.template, answers);
    if (errors.length) return reply.code(400).send({ data: null, error: { code: "FEEDBACK_INVALID", message: errors.join("; ") } });
    const accepted = await dependencies.feedbackPublic.submit({ capabilityId: value.capabilityId, campaignId: value.campaignId, templateVersion: value.templateVersion, customerId: "capability-bound", answers });
    return accepted ? reply.code(201).send({ data: { submitted: true }, error: null }) : reply.code(409).send({ data: null, error: { code: "FEEDBACK_USED", message: "This feedback link has already been used." } });
  });
  app.get<{ Params: { tenantId: string } }>("/v1/tenants/:tenantId/feedback-campaigns", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.feedbackAdmin) return reply.code(503).send({ data: null, error: { code: "FEEDBACK_ADMIN_UNAVAILABLE", message: "Feedback management is temporarily unavailable." } });
    return reply.send({ data: await dependencies.feedbackAdmin.listCampaigns(request.params.tenantId), error: null });
  });
  app.post<{ Params: { tenantId: string }; Body: FeedbackCampaignDraft }>("/v1/tenants/:tenantId/feedback-campaigns", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.feedbackAdmin?.createCampaign) return reply.code(503).send({ data: null, error: { code: "FEEDBACK_ADMIN_UNAVAILABLE", message: "Feedback management is temporarily unavailable." } });
    const draft = { ...request.body, tenantId: request.params.tenantId };
    const errors = validateFeedbackCampaign(draft);
    if (errors.length) return reply.code(400).send({ data: null, error: { code: "FEEDBACK_INVALID", message: errors.join("; ") } });
    return reply.code(201).send({ data: await dependencies.feedbackAdmin.createCampaign(draft), error: null });
  });
  app.post<{ Params: { tenantId: string; campaignId: string }; Body: { enabled: boolean } }>("/v1/tenants/:tenantId/feedback-campaigns/:campaignId/status", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.feedbackAdmin?.setCampaignStatus) return reply.code(503).send({ data: null, error: { code: "FEEDBACK_ADMIN_UNAVAILABLE", message: "Feedback management is temporarily unavailable." } });
    if (typeof request.body?.enabled !== "boolean") return reply.code(400).send({ data: null, error: { code: "FEEDBACK_INVALID", message: "Campaign status must be enabled or disabled." } });
    try {
      const changed = await dependencies.feedbackAdmin.setCampaignStatus(request.params.tenantId, request.params.campaignId, request.body.enabled);
      return changed ? reply.send({ data: { campaignId: request.params.campaignId, enabled: request.body.enabled }, error: null }) : reply.code(404).send({ data: null, error: { code: "FEEDBACK_NOT_FOUND", message: "This feedback campaign was not found." } });
    } catch (error) { return reply.code(400).send({ data: null, error: { code: "FEEDBACK_INVALID", message: error instanceof Error ? error.message : "Campaign status could not be changed." } });
    }
  });
  app.post<{ Params: { tenantId: string }; Body: FeedbackTemplateDraft }>("/v1/tenants/:tenantId/feedback-templates", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.feedbackAdmin) return reply.code(503).send({ data: null, error: { code: "FEEDBACK_ADMIN_UNAVAILABLE", message: "Feedback management is temporarily unavailable." } });
    const template = { ...request.body, presentation: request.body.presentation ?? "compact", questionsPerStep: request.body.questionsPerStep ?? null };
    const templateErrors = validateFeedbackTemplate(template);
    if (templateErrors.length) return reply.code(400).send({ data: null, error: { code: "FEEDBACK_INVALID", message: templateErrors.join("; ") } });
    return reply.code(201).send({ data: await dependencies.feedbackAdmin.createTemplate({ ...template, tenantId: request.params.tenantId }), error: null });
  });
  app.get<{ Params: { tenantId: string }; Querystring: { campaignId?: string } }>("/v1/tenants/:tenantId/feedback-responses", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.feedbackReporting) return reply.code(503).send({ data: null, error: { code: "FEEDBACK_REPORTING_UNAVAILABLE", message: "Feedback reporting is temporarily unavailable." } });
    return reply.send({ data: await dependencies.feedbackReporting.listResponses(request.params.tenantId, request.query.campaignId), error: null });
  });
  app.get<{ Params: { tenantId: string; campaignId: string }; Querystring: { templateVersion?: string } }>("/v1/tenants/:tenantId/feedback-campaigns/:campaignId/analytics", async (request, reply) => {
    const context = await dependencies.resolve(request);
    if (!context.identity || !context.membership || context.membership.tenantId !== request.params.tenantId || !["owner", "admin", "manager"].includes(context.membership.role)) return reply.code(403).send({ data: null, error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." } });
    if (!dependencies.feedbackReporting) return reply.code(503).send({ data: null, error: { code: "FEEDBACK_REPORTING_UNAVAILABLE", message: "Feedback reporting is temporarily unavailable." } });
    const version = request.query.templateVersion ? Number(request.query.templateVersion) : undefined;
    return reply.send({ data: await dependencies.feedbackReporting.analytics(request.params.tenantId, request.params.campaignId, version), error: null });
  });
  registerIndustryPackRoutes(app); registerIndustryPackSettingsRoutes(app, { resolve: dependencies.resolve, packAdmin: dependencies.packAdmin }); registerResourceRoutes(app, dependencies); registerServiceRoutes(app, { resolve: dependencies.resolve, serviceAdmin: dependencies.serviceAdmin }); registerServiceCompositionRoutes(app, { resolve: dependencies.resolve, compositionAdmin: dependencies.compositionAdmin }); registerRequirementAvailabilityRoutes(app, { resolve: dependencies.resolve, qrReader: dependencies.qrReader, requirementAvailabilityAdmin: dependencies.requirementAvailabilityAdmin }); registerOccurrenceRoutes(app, dependencies); registerManageBookingRoutes(app, dependencies); return app; }
