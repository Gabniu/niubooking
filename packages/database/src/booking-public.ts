// Ownership: transactional public hold adapter. Plaintext hold tokens never enter PostgreSQL.

import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Pool } from "pg";
import { validateRequirementAssignments, type Booking, type CommunicationChannel, type RequirementAssignment } from "@bookingapp/domain";
import { withTenantTransaction } from "./pg-executor.js";
import { createBooking } from "./bookings.js";
import { createCustomerProfile } from "./customer-profiles.js";
import { readQrDestination } from "./qr-destinations.js";
import { upsertCustomerContactMethod } from "./customer-contact-methods.js";
import { createBookingManageAdapter, issueBookingManageToken } from "./booking-manage.js";
import { listServiceRequirements } from "./service-variants.js";
import { listResources } from "./resources.js";

interface HoldRow { hold_id: string; tenant_id: string; public_code: string; hold_token_hash: string; customer_name: string; service_name: string; service_id?: string | null; variant_id?: string | null; starts_at: Date; ends_at: Date; expires_at: Date; status: "held" | "confirmed" | "expired"; booking_id: string | null; resource_ids?: string[]; requirement_assignments?: RequirementAssignment[]; }
interface PublicHold { holdId: string; holdToken: string; serviceName: string; startsAt: Date; endsAt: Date; expiresAt: Date; resourceIds?: readonly string[]; requirementAssignments?: readonly RequirementAssignment[]; }
export type PublicBookingConfirmation = Booking & { manageToken: string };
export interface PublicBookingConfirmedEvent { booking: Booking; contactMethodId: string | null; contactChannels: readonly CommunicationChannel[]; }
export interface PublicBookingManagedEvent { booking: Booking; }
const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const tokenFor = (secret: string, holdId: string): string => createHmac("sha256", secret).update(holdId).digest("base64url");
function mapHold(row: HoldRow, secret: string): PublicHold { return { holdId: row.hold_id, holdToken: tokenFor(secret, row.hold_id), serviceName: row.service_name, startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at), expiresAt: new Date(row.expires_at), ...(row.resource_ids?.length ? { resourceIds: row.resource_ids } : {}), ...(row.requirement_assignments?.length ? { requirementAssignments: row.requirement_assignments } : {}) }; }
function normalizeResourceIds(resourceIds: readonly string[] = []): string[] { const normalized = resourceIds.map((id) => id.trim()).filter(Boolean); if (normalized.length !== new Set(normalized).size) throw new Error("Booking resources must be unique and non-empty"); return normalized; }
function sameHash(expected: string, actual: string): boolean { const left = Buffer.from(expected, "hex"); const right = Buffer.from(actual, "hex"); return left.length === right.length && timingSafeEqual(left, right); }
function validWindow(startsAt: Date, endsAt: Date): void { if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) throw new Error("Booking times are invalid"); }
async function validateAssignments(executor: import("./tenant-membership.js").SqlExecutor, tenantId: string, serviceId: string | null | undefined, variantId: string | null | undefined, assignments: readonly RequirementAssignment[]): Promise<void> { if (!assignments.length) return; if (!serviceId) throw new Error("Requirement assignments need a service destination"); const [requirements, resources] = await Promise.all([listServiceRequirements(executor, tenantId, serviceId, variantId), listResources(executor, tenantId)]); const errors = validateRequirementAssignments(requirements, resources.map((resource) => ({ id: resource.id, resourceType: resource.resourceType, capabilities: resource.capabilities ?? [], active: resource.status === "active" })), assignments); if (errors.length) throw new Error(errors.join("; ")); }

export function createPublicBookingAdapter(pool: Pool, holdSecret: string, callbacks: { onConfirmed?: (event: PublicBookingConfirmedEvent) => Promise<void>; onContactCaptured?: (input: { tenantId: string; contactMethodId: string }) => Promise<void>; onRescheduled?: (event: PublicBookingManagedEvent) => Promise<void>; onCancelled?: (event: PublicBookingManagedEvent) => Promise<void> } = {}) {
  if (!holdSecret || holdSecret.length < 32) throw new Error("A 32-character booking hold secret is required");
  const management = createBookingManageAdapter(pool, holdSecret);
  return {
    async createHold(input: { tenantId: string; publicCode: string; customerName: string; serviceName: string; startsAt: Date; endsAt: Date; idempotencyKey: string; resourceIds?: readonly string[]; variantId?: string | null; requirementAssignments?: readonly RequirementAssignment[] }): Promise<PublicHold> {
      validWindow(input.startsAt, input.endsAt);
      const resourceIds = normalizeResourceIds(input.resourceIds);
      const requirementAssignments = input.requirementAssignments ? input.requirementAssignments.map((assignment) => ({ requirementId: assignment.requirementId, resourceIds: normalizeResourceIds(assignment.resourceIds) })) : [];
      const assignedResourceIds = normalizeResourceIds(requirementAssignments.flatMap((assignment) => assignment.resourceIds));
      if (requirementAssignments.length && resourceIds.length && (resourceIds.length !== assignedResourceIds.length || [...resourceIds].sort().join("|") !== [...assignedResourceIds].sort().join("|"))) throw new Error("Resource selection does not match requirement assignments");
      return withTenantTransaction(pool, input.tenantId, async (executor) => {
        const destination = await readQrDestination(executor, input.publicCode);
        if (!destination || destination.tenantId !== input.tenantId || destination.status !== "active" || (destination.expiresAt && destination.expiresAt <= new Date())) throw new Error("Booking link is unavailable");
        await validateAssignments(executor, input.tenantId, destination.serviceId, input.variantId, requirementAssignments);
        const selectedResourceIds = assignedResourceIds.length ? assignedResourceIds : resourceIds;
        if (selectedResourceIds.length) { const resources = await executor.query<{ id: string }>("SELECT id FROM booking_resources WHERE tenant_id = $1 AND id = ANY($2::text[]) AND status = 'active'", [input.tenantId, selectedResourceIds]); if (resources.length !== selectedResourceIds.length) throw new Error("One or more booking resources are unavailable"); }
        const existing = await executor.query<HoldRow>("SELECT hold_id, tenant_id, public_code, hold_token_hash, customer_name, service_name, service_id, variant_id, starts_at, ends_at, expires_at, status, booking_id, resource_ids, requirement_assignments FROM booking_holds WHERE tenant_id = $1 AND create_idempotency_key = $2", [input.tenantId, input.idempotencyKey]);
        if (existing[0]) {
          if (existing[0].status === "held" && existing[0].expires_at > new Date()) return mapHold(existing[0], holdSecret);
          throw new Error("Booking request has already been used");
        }
        const holdId = randomBytes(18).toString("base64url");
        const expiresAt = new Date(Date.now() + 10 * 60_000);
        const rows = await executor.query<HoldRow>("INSERT INTO booking_holds (hold_id, tenant_id, public_code, hold_token_hash, customer_name, service_name, service_id, variant_id, starts_at, ends_at, expires_at, resource_ids, requirement_assignments, create_idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING hold_id, tenant_id, public_code, hold_token_hash, customer_name, service_name, service_id, variant_id, starts_at, ends_at, expires_at, status, booking_id, resource_ids, requirement_assignments", [holdId, input.tenantId, input.publicCode, hash(tokenFor(holdSecret, holdId)), input.customerName.trim(), input.serviceName.trim(), destination.serviceId, input.variantId ?? null, input.startsAt, input.endsAt, expiresAt, selectedResourceIds, JSON.stringify(requirementAssignments), input.idempotencyKey]);
        if (!rows[0]) throw new Error("Booking hold creation returned no row");
        return mapHold(rows[0], holdSecret);
      });
    },
    async confirmHold(input: { tenantId: string; publicCode: string; holdId: string; holdToken: string; idempotencyKey: string; contact?: { channel: CommunicationChannel; destination: string; consentGranted: boolean } }): Promise<PublicBookingConfirmation | null> {
      let capturedContactMethodId: string | null = null;
      let alreadyConfirmed = false;
      const booking = await withTenantTransaction(pool, input.tenantId, async (executor) => {
        const rows = await executor.query<HoldRow>("SELECT hold_id, tenant_id, public_code, hold_token_hash, customer_name, service_name, service_id, variant_id, starts_at, ends_at, expires_at, status, booking_id, resource_ids, requirement_assignments FROM booking_holds WHERE tenant_id = $1 AND hold_id = $2 FOR UPDATE", [input.tenantId, input.holdId]);
        const hold = rows[0];
        if (!hold || hold.public_code !== input.publicCode || !sameHash(hold.hold_token_hash, hash(input.holdToken))) return null;
        if (hold.status === "confirmed" && hold.booking_id) { alreadyConfirmed = true; const existing = await executor.query<{ id: string; tenant_id: string; customer_id: string; service_name: string; starts_at: Date; ends_at: Date; status: "scheduled" | "cancelled" | "completed" }>("SELECT id, tenant_id, customer_id, service_name, starts_at, ends_at, status FROM bookings WHERE tenant_id = $1 AND id = $2", [input.tenantId, hold.booking_id]); if (!existing[0]) return null; const existingBooking = { id: existing[0].id, tenantId: existing[0].tenant_id, customerId: existing[0].customer_id, serviceName: existing[0].service_name, startsAt: new Date(existing[0].starts_at), endsAt: new Date(existing[0].ends_at), status: existing[0].status, ...(hold.resource_ids?.length ? { resourceIds: hold.resource_ids } : {}) }; return { ...existingBooking, manageToken: await issueBookingManageToken(executor, existingBooking, holdSecret) }; }
        if (hold.status !== "held" || hold.expires_at <= new Date()) return null;
        await validateAssignments(executor, input.tenantId, hold.service_id, hold.variant_id, hold.requirement_assignments ?? []);
        const customer = await createCustomerProfile(executor, { id: randomBytes(18).toString("base64url"), tenantId: input.tenantId, displayName: hold.customer_name });
        const booking = await createBooking(executor, { id: randomBytes(18).toString("base64url"), tenantId: input.tenantId, customerId: customer.id, serviceName: hold.service_name, startsAt: new Date(hold.starts_at), endsAt: new Date(hold.ends_at), resourceIds: hold.resource_ids ?? [] });
        if (input.contact) { capturedContactMethodId = randomBytes(18).toString("base64url"); await upsertCustomerContactMethod(executor, { id: capturedContactMethodId, tenantId: input.tenantId, customerId: customer.id, channel: input.contact.channel, destination: input.contact.destination, consentStatus: input.contact.consentGranted ? "granted" : "unknown", verifiedAt: null }); }
        const manageToken = await issueBookingManageToken(executor, booking, holdSecret);
        await executor.query("UPDATE booking_holds SET status = 'confirmed', booking_id = $1, confirm_idempotency_key = $2, updated_at = now() WHERE tenant_id = $3 AND hold_id = $4", [booking.id, input.idempotencyKey, input.tenantId, input.holdId]);
        return { ...booking, manageToken };
      });
      if (!alreadyConfirmed && booking && callbacks.onConfirmed) await callbacks.onConfirmed({ booking, contactMethodId: capturedContactMethodId, contactChannels: input.contact?.consentGranted ? [input.contact.channel] : [] });
      if (!alreadyConfirmed && booking && input.contact?.consentGranted && capturedContactMethodId && callbacks.onContactCaptured) await callbacks.onContactCaptured({ tenantId: input.tenantId, contactMethodId: capturedContactMethodId });
      return booking;
    },
    readManage: management.read,
    rescheduleManage: async (token: string, startsAt: Date, endsAt: Date, idempotencyKey: string) => { const booking = await management.reschedule(token, startsAt, endsAt, idempotencyKey); if (booking && callbacks.onRescheduled) await callbacks.onRescheduled({ booking }); return booking; },
    cancelManage: async (token: string, idempotencyKey: string) => { const booking = await management.cancel(token, idempotencyKey); if (booking && booking.status === "cancelled" && callbacks.onCancelled) await callbacks.onCancelled({ booking }); return booking; },
  };
}
