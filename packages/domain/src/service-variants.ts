// Ownership: service catalog composition; allocation remains the scheduling kernel's responsibility.

export type ServiceVariantStatus = "active" | "inactive";
export type ServiceRequirementKind = "resource";

export interface ServiceVariant {
  id: string;
  tenantId: string;
  serviceId: string;
  name: string;
  durationMinutes: number | null;
  bufferBeforeMinutes: number | null;
  bufferAfterMinutes: number | null;
  priceCents: number | null;
  currency: string | null;
  status: ServiceVariantStatus;
}

export interface ServiceVariantDraft {
  id: string;
  tenantId: string;
  serviceId: string;
  name: string;
  durationMinutes?: number | null;
  bufferBeforeMinutes?: number | null;
  bufferAfterMinutes?: number | null;
  priceCents?: number | null;
  currency?: string | null;
}

export interface ServiceRequirement {
  id: string;
  tenantId: string;
  serviceId: string;
  variantId: string | null;
  kind: ServiceRequirementKind;
  label: string;
  quantity: number;
  resourceType: string | null;
  capabilityKey: string | null;
  status: ServiceVariantStatus;
}

export interface ServiceRequirementDraft {
  id: string;
  tenantId: string;
  serviceId: string;
  variantId?: string | null;
  kind: ServiceRequirementKind;
  label: string;
  quantity?: number;
  resourceType?: string | null;
  capabilityKey?: string | null;
}

function validateOverride(value: number | null | undefined, label: string, minimum: number, maximum: number, errors: string[]): void {
  if (value !== null && value !== undefined && (!Number.isInteger(value) || value < minimum || value > maximum)) errors.push(`${label} must be a whole number between ${minimum} and ${maximum}`);
}

export function validateServiceVariantDraft(draft: ServiceVariantDraft): string[] {
  const errors: string[] = [];
  if (!draft.id || !draft.tenantId || !draft.serviceId) errors.push("Variant identity is required");
  if (!draft.name.trim() || draft.name.trim().length > 200) errors.push("Variant name must be between 1 and 200 characters");
  validateOverride(draft.durationMinutes, "Variant duration", 5, 1440, errors);
  validateOverride(draft.bufferBeforeMinutes, "Variant before buffer", 0, 1440, errors);
  validateOverride(draft.bufferAfterMinutes, "Variant after buffer", 0, 1440, errors);
  if (draft.priceCents !== null && draft.priceCents !== undefined && (!Number.isInteger(draft.priceCents) || draft.priceCents < 0)) errors.push("Variant price must be a non-negative whole number of cents");
  if (draft.currency !== null && draft.currency !== undefined && !/^[A-Z]{3}$/u.test(draft.currency)) errors.push("Variant currency must be a three-letter code");
  return errors;
}

export function validateServiceRequirementDraft(draft: ServiceRequirementDraft): string[] {
  const errors: string[] = [];
  if (!draft.id || !draft.tenantId || !draft.serviceId) errors.push("Requirement identity is required");
  if (draft.variantId === "") errors.push("Requirement variant is invalid");
  if (draft.kind !== "resource") errors.push("Requirement kind is invalid");
  if (!draft.label.trim() || draft.label.trim().length > 120) errors.push("Requirement label must be between 1 and 120 characters");
  if (!Number.isInteger(draft.quantity ?? 1) || (draft.quantity ?? 1) < 1 || (draft.quantity ?? 1) > 16) errors.push("Requirement quantity must be between 1 and 16");
  const resourceType = draft.resourceType?.trim() || "";
  const capabilityKey = draft.capabilityKey?.trim() || "";
  if (!resourceType && !capabilityKey) errors.push("Requirement needs a resource type or capability");
  if (resourceType.length > 100 || capabilityKey.length > 100) errors.push("Requirement selectors must be 100 characters or fewer");
  return errors;
}
