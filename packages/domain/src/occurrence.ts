// Ownership: universal dated service occurrence and reservation invariants.

export type OccurrenceStatus = "draft" | "published" | "open" | "closed" | "cancelled" | "completed";
export type ReservationStatus = "held" | "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show";

export interface ServiceOccurrence {
  id: string;
  tenantId: string;
  serviceId: string;
  label: string;
  startsAt: Date;
  endsAt: Date;
  status: OccurrenceStatus;
  capacity: number | null;
  reservedQuantity: number;
}

export interface ServiceOccurrenceDraft {
  id: string;
  tenantId: string;
  serviceId: string;
  label: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  status?: OccurrenceStatus;
}

export interface Reservation {
  id: string;
  tenantId: string;
  occurrenceId: string;
  customerId: string;
  quantity: number;
  status: ReservationStatus;
}

export interface ReservationDraft {
  id: string;
  tenantId: string;
  occurrenceId: string;
  customerId: string;
  quantity: number;
  createIdempotencyKey?: string;
}

const reservingStatuses = new Set<ReservationStatus>(["held", "confirmed", "checked_in"]);

const reservationTransitions: Record<ReservationStatus, readonly ReservationStatus[]> = {
  held: ["confirmed", "cancelled", "no_show"],
  confirmed: ["checked_in", "completed", "cancelled", "no_show"],
  checked_in: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function validateReservationStatusChange(current: ReservationStatus, next: ReservationStatus): string[] {
  if (current === next) return [];
  return reservationTransitions[current].includes(next) ? [] : [`Reservation cannot move from ${current} to ${next}`];
}

export function validateOccurrenceDraft(draft: ServiceOccurrenceDraft): string[] {
  const errors: string[] = [];
  if (!draft.id || !draft.tenantId || !draft.serviceId) errors.push("Occurrence identity is required");
  if (!draft.label.trim() || draft.label.trim().length > 200) errors.push("Occurrence label must be between 1 and 200 characters");
  if (!Number.isFinite(draft.startsAt.getTime()) || !Number.isFinite(draft.endsAt.getTime()) || draft.endsAt <= draft.startsAt) {
    errors.push("Occurrence times must be valid and end after start");
  }
  if (draft.capacity !== null && (!Number.isInteger(draft.capacity) || draft.capacity <= 0)) errors.push("Occurrence capacity must be null or a positive integer");
  return errors;
}

export function validateReservationDraft(draft: ReservationDraft, occurrence: Pick<ServiceOccurrence, "tenantId" | "status" | "capacity" | "reservedQuantity">): string[] {
  const errors: string[] = [];
  if (!draft.id || !draft.tenantId || !draft.occurrenceId || !draft.customerId) errors.push("Reservation identity is required");
  if (draft.tenantId !== occurrence.tenantId) errors.push("Reservation and occurrence must share a tenant");
  if (!Number.isInteger(draft.quantity) || draft.quantity <= 0) errors.push("Reservation quantity must be a positive integer");
  if (draft.createIdempotencyKey !== undefined && (draft.createIdempotencyKey.trim().length < 8 || draft.createIdempotencyKey.trim().length > 200)) errors.push("Reservation idempotency key must be between 8 and 200 characters");
  if (!["published", "open"].includes(occurrence.status)) errors.push("Occurrence is not accepting reservations");
  if (occurrence.capacity !== null && draft.quantity + occurrence.reservedQuantity > occurrence.capacity) errors.push("Occurrence capacity is unavailable");
  return errors;
}

export function isCapacityReserving(status: ReservationStatus): boolean {
  return reservingStatuses.has(status);
}
