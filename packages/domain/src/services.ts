// Ownership: tenant service catalog; packs contribute defaults without forking scheduling invariants.

export type ServiceStatus = "active" | "inactive";
export type ServiceBookingMode = "appointment" | "occurrence";
export interface ServiceDefinition { id: string; tenantId: string; name: string; description: string | null; bookingMode: ServiceBookingMode; durationMinutes: number; bufferBeforeMinutes: number; bufferAfterMinutes: number; priceCents: number | null; currency: string | null; packId: string | null; status: ServiceStatus; }
export interface ServiceDefinitionDraft { id: string; tenantId: string; name: string; description?: string | null; bookingMode: ServiceBookingMode; durationMinutes: number; bufferBeforeMinutes?: number; bufferAfterMinutes?: number; priceCents?: number | null; currency?: string | null; packId?: string | null; }

export function validateServiceDefinitionDraft(service: ServiceDefinitionDraft): string[] {
  const errors: string[] = [];
  if (!service.id || !service.tenantId) errors.push("Service identity is required");
  if (!service.name.trim() || service.name.trim().length > 200) errors.push("Service name must be between 1 and 200 characters");
  if (!["appointment", "occurrence"].includes(service.bookingMode)) errors.push("Service booking mode is invalid");
  if (!Number.isInteger(service.durationMinutes) || service.durationMinutes < 5 || service.durationMinutes > 1440) errors.push("Service duration must be between 5 and 1440 minutes");
  for (const value of [service.bufferBeforeMinutes ?? 0, service.bufferAfterMinutes ?? 0]) if (!Number.isInteger(value) || value < 0 || value > 1440) errors.push("Service buffers must be whole minutes between 0 and 1440");
  if (service.priceCents !== null && service.priceCents !== undefined && (!Number.isInteger(service.priceCents) || service.priceCents < 0)) errors.push("Service price must be a non-negative whole number of cents");
  if (service.currency !== null && service.currency !== undefined && !/^[A-Z]{3}$/u.test(service.currency)) errors.push("Service currency must be a three-letter code");
  if (service.description && service.description.trim().length > 1000) errors.push("Service description must be 1000 characters or fewer");
  return errors;
}
