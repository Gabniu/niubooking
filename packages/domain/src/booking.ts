// Ownership: universal appointment record. Industry packs may add service metadata later.

export type BookingStatus = "scheduled" | "cancelled" | "completed";

export interface Booking {
  id: string;
  tenantId: string;
  customerId: string;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
  resourceIds?: readonly string[];
}

export interface BookingDraft { id: string; tenantId: string; customerId: string; serviceName: string; startsAt: Date; endsAt: Date; resourceIds?: readonly string[]; }

export interface AvailabilityWindow { from: Date; to: Date; durationMinutes: number; stepMinutes: number; }

export function validateBookingDraft(draft: BookingDraft): string[] {
  const errors: string[] = [];
  if (!draft.id || !draft.tenantId || !draft.customerId) errors.push("Booking identity is required");
  const name = draft.serviceName.trim();
  if (!name || name.length > 200) errors.push("Service name must be between 1 and 200 characters");
  if (Number.isNaN(draft.startsAt.getTime()) || Number.isNaN(draft.endsAt.getTime()) || draft.endsAt <= draft.startsAt) errors.push("Booking times must be valid and end after start");
  return errors;
}

export function findAvailableStarts(bookings: readonly Pick<Booking, "startsAt" | "endsAt" | "status">[], window: AvailabilityWindow): readonly Date[] {
  if (window.durationMinutes <= 0 || window.stepMinutes <= 0 || window.to <= window.from) return [];
  const duration = window.durationMinutes * 60_000;
  const slots: Date[] = [];
  for (let cursor = window.from.getTime(); cursor + duration <= window.to.getTime(); cursor += window.stepMinutes * 60_000) {
    const end = cursor + duration;
    const overlaps = bookings.some((booking) => booking.status === "scheduled" && booking.startsAt.getTime() < end && booking.endsAt.getTime() > cursor);
    if (!overlaps) slots.push(new Date(cursor));
  }
  return slots;
}

export interface SchedulableResource { id: string; active?: boolean; }
export interface ResourceAvailabilitySlot { startsAt: Date; endsAt: Date; resourceIds: readonly string[]; }
export interface ResourceBookingOccupancy { startsAt: Date; endsAt: Date; status: BookingStatus; resourceIds?: readonly string[]; }

export function findAvailableResourceSlots(bookings: readonly ResourceBookingOccupancy[], resources: readonly SchedulableResource[], window: AvailabilityWindow, requiredResourceCount = 1): readonly ResourceAvailabilitySlot[] {
  if (!Number.isInteger(requiredResourceCount) || requiredResourceCount <= 0 || window.durationMinutes <= 0 || window.stepMinutes <= 0 || window.to <= window.from) return [];
  const activeResources = resources.filter((resource) => resource.active !== false && resource.id.trim().length > 0);
  if (activeResources.length < requiredResourceCount) return [];
  const duration = window.durationMinutes * 60_000;
  const slots: ResourceAvailabilitySlot[] = [];
  for (let cursor = window.from.getTime(); cursor + duration <= window.to.getTime(); cursor += window.stepMinutes * 60_000) {
    const startsAt = new Date(cursor);
    const endsAt = new Date(cursor + duration);
    const available = activeResources.filter((resource) => !bookings.some((booking) => booking.status === "scheduled" && booking.resourceIds?.includes(resource.id) && booking.startsAt < endsAt && booking.endsAt > startsAt));
    if (available.length >= requiredResourceCount) slots.push({ startsAt, endsAt, resourceIds: available.slice(0, requiredResourceCount).map((resource) => resource.id) });
  }
  return slots;
}
