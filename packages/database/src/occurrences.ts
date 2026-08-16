// Ownership: tenant-scoped occurrence and reservation persistence with atomic capacity admission.

import { isCapacityReserving, validateOccurrenceDraft, validateReservationDraft, validateReservationStatusChange, type CommunicationChannel, type Reservation, type ReservationDraft, type ReservationStatus, type ServiceOccurrence, type ServiceOccurrenceDraft } from "@bookingapp/domain";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { withTenantTransaction } from "./pg-executor.js";
import type { SqlExecutor } from "./tenant-membership.js";
import { readQrDestination } from "./qr-destinations.js";
import { createCustomerProfile } from "./customer-profiles.js";
import { upsertCustomerContactMethod } from "./customer-contact-methods.js";
import { appendAuditEvent } from "./audit-events.js";

interface OccurrenceRow { id: string; tenant_id: string; service_id: string; label: string; starts_at: Date; ends_at: Date; status: ServiceOccurrence["status"]; capacity: number | null; reserved_quantity: number; }
interface ReservationRow { id: string; tenant_id: string; occurrence_id: string; customer_id: string; quantity: number; status: Reservation["status"]; }

function mapOccurrence(row: OccurrenceRow): ServiceOccurrence {
  return { id: row.id, tenantId: row.tenant_id, serviceId: row.service_id, label: row.label, startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at), status: row.status, capacity: row.capacity, reservedQuantity: row.reserved_quantity };
}
function mapReservation(row: ReservationRow): Reservation {
  return { id: row.id, tenantId: row.tenant_id, occurrenceId: row.occurrence_id, customerId: row.customer_id, quantity: row.quantity, status: row.status };
}

const occurrenceColumns = "id, tenant_id, service_id, label, starts_at, ends_at, status, capacity, reserved_quantity";
const reservationColumns = "id, tenant_id, occurrence_id, customer_id, quantity, status";

export async function listOccurrences(executor: SqlExecutor, tenantId: string, from?: Date, to?: Date, serviceId?: string): Promise<readonly ServiceOccurrence[]> {
  const rows = await executor.query<OccurrenceRow>(`SELECT ${occurrenceColumns} FROM service_occurrences WHERE tenant_id = $1 AND ($2::timestamptz IS NULL OR ends_at > $2) AND ($3::timestamptz IS NULL OR starts_at < $3) AND ($4::text IS NULL OR service_id = $4) ORDER BY starts_at, id`, [tenantId, from ?? null, to ?? null, serviceId ?? null]);
  return rows.map(mapOccurrence);
}

export async function createOccurrence(executor: SqlExecutor, draft: ServiceOccurrenceDraft): Promise<ServiceOccurrence> {
  const errors = validateOccurrenceDraft(draft);
  if (errors.length) throw new Error(errors.join("; "));
  const rows = await executor.query<OccurrenceRow>(`INSERT INTO service_occurrences (id, tenant_id, service_id, label, starts_at, ends_at, capacity, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${occurrenceColumns}`, [draft.id, draft.tenantId, draft.serviceId, draft.label.trim(), draft.startsAt, draft.endsAt, draft.capacity, draft.status ?? "draft"]);
  if (!rows[0]) throw new Error("Occurrence creation returned no row");
  return mapOccurrence(rows[0]);
}

export async function createReservation(executor: SqlExecutor, draft: ReservationDraft): Promise<Reservation> {
  // The atomic update and insert must be invoked inside the caller's transaction boundary.
  if (draft.createIdempotencyKey) {
    const existing = await executor.query<ReservationRow>(`SELECT ${reservationColumns} FROM service_reservations WHERE tenant_id = $1 AND create_idempotency_key = $2 LIMIT 1`, [draft.tenantId, draft.createIdempotencyKey]);
    if (existing[0]) return mapReservation(existing[0]);
  }
  const available = await executor.query<OccurrenceRow>(`UPDATE service_occurrences SET reserved_quantity = reserved_quantity + $3, updated_at = now() WHERE tenant_id = $1 AND id = $2 AND status IN ('published', 'open') AND (capacity IS NULL OR reserved_quantity + $3 <= capacity) RETURNING ${occurrenceColumns}`, [draft.tenantId, draft.occurrenceId, draft.quantity]);
  const occurrence = available[0];
  if (!occurrence) throw new Error("Occurrence is unavailable or full");
  const errors = validateReservationDraft(draft, { ...mapOccurrence(occurrence), reservedQuantity: occurrence.reserved_quantity - draft.quantity });
  if (errors.length) throw new Error(errors.join("; "));
  const rows = await executor.query<ReservationRow>(`INSERT INTO service_reservations (id, tenant_id, occurrence_id, customer_id, quantity, create_idempotency_key) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_id, create_idempotency_key) WHERE create_idempotency_key IS NOT NULL DO NOTHING RETURNING ${reservationColumns}`, [draft.id, draft.tenantId, draft.occurrenceId, draft.customerId, draft.quantity, draft.createIdempotencyKey ?? null]);
  if (!rows[0] && draft.createIdempotencyKey) {
    await executor.query("UPDATE service_occurrences SET reserved_quantity = reserved_quantity - $3, updated_at = now() WHERE tenant_id = $1 AND id = $2", [draft.tenantId, draft.occurrenceId, draft.quantity]);
    const existing = await executor.query<ReservationRow>(`SELECT ${reservationColumns} FROM service_reservations WHERE tenant_id = $1 AND create_idempotency_key = $2 LIMIT 1`, [draft.tenantId, draft.createIdempotencyKey]);
    if (existing[0]) return mapReservation(existing[0]);
  }
  if (!rows[0]) throw new Error("Reservation creation returned no row");
  return mapReservation(rows[0]);
}

export async function listReservations(executor: SqlExecutor, tenantId: string, occurrenceId: string): Promise<readonly Reservation[]> {
  const rows = await executor.query<ReservationRow>(`SELECT ${reservationColumns} FROM service_reservations WHERE tenant_id = $1 AND occurrence_id = $2 ORDER BY id`, [tenantId, occurrenceId]);
  return rows.map(mapReservation);
}

export async function setReservationStatus(executor: SqlExecutor, input: { tenantId: string; occurrenceId: string; reservationId: string; status: ReservationStatus; actorId?: string }): Promise<Reservation> {
  const rows = await executor.query<ReservationRow>(`SELECT ${reservationColumns} FROM service_reservations WHERE tenant_id = $1 AND occurrence_id = $2 AND id = $3 FOR UPDATE`, [input.tenantId, input.occurrenceId, input.reservationId]);
  const current = rows[0];
  if (!current) throw new Error("Reservation was not found");
  const transitionErrors = validateReservationStatusChange(current.status, input.status);
  if (transitionErrors.length) throw new Error(transitionErrors.join("; "));
  if (current.status !== input.status && isCapacityReserving(current.status) !== isCapacityReserving(input.status)) {
    const direction = isCapacityReserving(input.status) ? "reserve" : "release";
    const updated = direction === "reserve"
      ? await executor.query<OccurrenceRow>(`UPDATE service_occurrences SET reserved_quantity = reserved_quantity + $3, updated_at = now() WHERE tenant_id = $1 AND id = $2 AND status IN ('published', 'open') AND (capacity IS NULL OR reserved_quantity + $3 <= capacity) RETURNING ${occurrenceColumns}`, [input.tenantId, input.occurrenceId, current.quantity])
      : await executor.query<OccurrenceRow>(`UPDATE service_occurrences SET reserved_quantity = reserved_quantity - $3, updated_at = now() WHERE tenant_id = $1 AND id = $2 AND reserved_quantity >= $3 RETURNING ${occurrenceColumns}`, [input.tenantId, input.occurrenceId, current.quantity]);
    if (!updated[0]) throw new Error(direction === "reserve" ? "Occurrence capacity is unavailable" : "Occurrence inventory is inconsistent");
  }
  const updatedReservation = await executor.query<ReservationRow>(`UPDATE service_reservations SET status = $4, updated_at = now() WHERE tenant_id = $1 AND occurrence_id = $2 AND id = $3 RETURNING ${reservationColumns}`, [input.tenantId, input.occurrenceId, input.reservationId, input.status]);
  if (!updatedReservation[0]) throw new Error("Reservation status could not be updated");
  if (current.status !== input.status) await appendAuditEvent(executor, { tenantId: input.tenantId, actorType: input.actorId ? "user" : "system", actorId: input.actorId ?? null, action: "reservation.status_changed", entityType: "reservation", entityId: input.reservationId, metadata: { occurrence_id: input.occurrenceId, from_status: current.status, to_status: input.status, quantity: current.quantity } });
  return mapReservation(updatedReservation[0]);
}

export interface PublicOccurrenceReservationInput {
  tenantId: string;
  publicCode: string;
  occurrenceId: string;
  customerName: string;
  quantity: number;
  idempotencyKey: string;
  contact?: { channel: CommunicationChannel; destination: string; consentGranted: boolean };
}

export interface PublicOccurrenceReservedEvent { reservation: Reservation; occurrence: ServiceOccurrence; contactChannels: readonly CommunicationChannel[]; }
export interface OccurrenceReservationStatusChangedEvent { reservation: Reservation; actorId: string | null; }

export async function createPublicOccurrenceReservation(executor: SqlExecutor, input: PublicOccurrenceReservationInput): Promise<Reservation> {
  await executor.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${input.tenantId}:${input.idempotencyKey}`]);
  const existing = await executor.query<ReservationRow>(`SELECT ${reservationColumns} FROM service_reservations WHERE tenant_id = $1 AND create_idempotency_key = $2 LIMIT 1`, [input.tenantId, input.idempotencyKey]);
  if (existing[0]) return mapReservation(existing[0]);
  const destination = await readQrDestination(executor, input.publicCode);
  if (!destination || destination.tenantId !== input.tenantId) throw new Error("QR destination is unavailable");
  const occurrenceRows = await executor.query<{ service_id: string }>("SELECT service_id FROM service_occurrences WHERE tenant_id = $1 AND id = $2 LIMIT 1", [input.tenantId, input.occurrenceId]);
  if (!occurrenceRows[0] || (destination.serviceId && destination.serviceId !== occurrenceRows[0].service_id)) throw new Error("Occurrence is invalid for this booking link");
  const customer = await createCustomerProfile(executor, { id: randomUUID(), tenantId: input.tenantId, displayName: input.customerName });
  const reservation = await createReservation(executor, { id: randomUUID(), tenantId: input.tenantId, occurrenceId: input.occurrenceId, customerId: customer.id, quantity: input.quantity, createIdempotencyKey: input.idempotencyKey });
  if (input.contact) await upsertCustomerContactMethod(executor, { id: randomUUID(), tenantId: input.tenantId, customerId: reservation.customerId, channel: input.contact.channel, destination: input.contact.destination, consentStatus: input.contact.consentGranted ? "granted" : "denied", verifiedAt: null });
  return reservation;
}

export function createDatabaseOccurrenceAdmin(pool: Pool, callbacks: { onPublicReserved?: ((event: PublicOccurrenceReservedEvent) => Promise<void>) | undefined; onReservationStatusChanged?: ((event: OccurrenceReservationStatusChangedEvent) => Promise<void>) | undefined } = {}) {
  return {
    list: (tenantId: string, from?: Date, to?: Date) => withTenantTransaction(pool, tenantId, (executor) => listOccurrences(executor, tenantId, from, to)),
    listReservations: (tenantId: string, occurrenceId: string) => withTenantTransaction(pool, tenantId, (executor) => listReservations(executor, tenantId, occurrenceId)),
    discover: (tenantId: string, serviceId: string | null, from?: Date, to?: Date) => withTenantTransaction(pool, tenantId, (executor) => listOccurrences(executor, tenantId, from, to, serviceId ?? undefined)),
    create: (draft: ServiceOccurrenceDraft) => withTenantTransaction(pool, draft.tenantId, (executor) => createOccurrence(executor, draft)),
    reserve: (draft: ReservationDraft) => withTenantTransaction(pool, draft.tenantId, (executor) => createReservation(executor, draft)),
    setReservationStatus: async (input: { tenantId: string; occurrenceId: string; reservationId: string; status: ReservationStatus; actorId?: string }) => {
      const reservation = await withTenantTransaction(pool, input.tenantId, (executor) => setReservationStatus(executor, input));
      if (callbacks.onReservationStatusChanged) await callbacks.onReservationStatusChanged({ reservation, actorId: input.actorId ?? null });
      return reservation;
    },
    reservePublic: async (input: PublicOccurrenceReservationInput) => {
      let event: PublicOccurrenceReservedEvent | null = null;
      const reservation = await withTenantTransaction(pool, input.tenantId, async (executor) => {
        const value = await createPublicOccurrenceReservation(executor, input);
        const rows = await executor.query<OccurrenceRow>(`SELECT ${occurrenceColumns} FROM service_occurrences WHERE tenant_id = $1 AND id = $2 LIMIT 1`, [input.tenantId, input.occurrenceId]);
        if (rows[0]) event = { reservation: value, occurrence: mapOccurrence(rows[0]), contactChannels: input.contact?.consentGranted ? [input.contact.channel] : [] };
        return value;
      });
      if (event && callbacks.onPublicReserved) await callbacks.onPublicReserved(event);
      return reservation;
    },
  };
}
