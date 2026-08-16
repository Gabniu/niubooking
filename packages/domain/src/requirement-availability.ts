// Ownership: pure, explainable requirement matching; PostgreSQL remains the confirmation authority.

import type { AvailabilityWindow } from "./booking.js";
import type { ServiceRequirement } from "./service-variants.js";

export interface RequirementResource { id: string; resourceType: string; capabilities?: readonly string[]; active?: boolean; }
export interface RequirementAllocation { resourceId: string; startsAt: Date; endsAt: Date; status: "scheduled" | "cancelled" | "completed"; }
export interface RequirementAssignment { requirementId: string; resourceIds: readonly string[]; requirementLabel?: string; }
export interface RequirementAvailabilitySlot { startsAt: Date; endsAt: Date; assignments: readonly RequirementAssignment[]; }
export type RequirementRejectionReason = "NO_COMPATIBLE_RESOURCES" | "INSUFFICIENT_RESOURCES";
export interface RequirementAvailabilityResult { slots: readonly RequirementAvailabilitySlot[]; rejected: readonly { requirementId: string; reason: RequirementRejectionReason }[]; }
function matches(resource: RequirementResource, requirement: Pick<ServiceRequirement, "resourceType" | "capabilityKey">): boolean { return resource.active !== false && (!requirement.resourceType || resource.resourceType === requirement.resourceType) && (!requirement.capabilityKey || (resource.capabilities ?? []).includes(requirement.capabilityKey)); }
export function validateRequirementAssignments(requirements: readonly Pick<ServiceRequirement, "id" | "quantity" | "resourceType" | "capabilityKey" | "status">[], resources: readonly RequirementResource[], assignments: readonly RequirementAssignment[]): string[] {
  const errors: string[] = []; const activeRequirements = requirements.filter((requirement) => requirement.status === "active"); const byId = new Map(activeRequirements.map((requirement) => [requirement.id, requirement])); const assigned = new Set<string>(); const used = new Set<string>();
  for (const assignment of assignments) { const requirement = byId.get(assignment.requirementId); if (!requirement) { errors.push(`Unknown or inactive requirement: ${assignment.requirementId}`); continue; } if (assigned.has(requirement.id)) { errors.push(`Requirement is assigned more than once: ${requirement.id}`); continue; } assigned.add(requirement.id); if (assignment.resourceIds.length !== requirement.quantity) errors.push(`Requirement ${requirement.id} needs exactly ${requirement.quantity} resource(s)`); for (const resourceId of assignment.resourceIds) { if (used.has(resourceId)) { errors.push(`Resource is assigned more than once: ${resourceId}`); continue; } used.add(resourceId); const resource = resources.find((candidate) => candidate.id === resourceId); if (!resource || !matches(resource, requirement)) errors.push(`Resource does not satisfy requirement ${requirement.id}: ${resourceId}`); } }
  for (const requirement of activeRequirements) if (!assigned.has(requirement.id)) errors.push(`Requirement is not assigned: ${requirement.id}`);
  return errors;
}
function occupied(resourceId: string, allocations: readonly RequirementAllocation[], startsAt: Date, endsAt: Date): boolean { return allocations.some((allocation) => allocation.status === "scheduled" && allocation.resourceId === resourceId && allocation.startsAt < endsAt && allocation.endsAt > startsAt); }
export function findRequirementAvailability(requirements: readonly (Pick<ServiceRequirement, "id" | "quantity" | "resourceType" | "capabilityKey"> & { label?: string })[], resources: readonly RequirementResource[], allocations: readonly RequirementAllocation[], window: AvailabilityWindow): RequirementAvailabilityResult {
  if (window.durationMinutes <= 0 || window.stepMinutes <= 0 || window.to <= window.from || !requirements.length) return { slots: [], rejected: requirements.map((requirement) => ({ requirementId: requirement.id, reason: "NO_COMPATIBLE_RESOURCES" })) };
  const rejected = new Map<string, RequirementRejectionReason>(); const slots: RequirementAvailabilitySlot[] = []; const duration = window.durationMinutes * 60_000;
  for (let cursor = window.from.getTime(); cursor + duration <= window.to.getTime(); cursor += window.stepMinutes * 60_000) { const startsAt = new Date(cursor); const endsAt = new Date(cursor + duration); const assignments: RequirementAssignment[] = []; const used = new Set<string>();
    const assign = (index: number): boolean => { const requirement = requirements[index]; if (!requirement) return true; const compatible = resources.filter((resource) => matches(resource, requirement) && !used.has(resource.id)); const eligible = compatible.filter((resource) => !occupied(resource.id, allocations, startsAt, endsAt)); if (eligible.length < requirement.quantity) { rejected.set(requirement.id, compatible.length ? "INSUFFICIENT_RESOURCES" : "NO_COMPATIBLE_RESOURCES"); return false; } const selected = eligible.slice(0, requirement.quantity).map((resource) => resource.id); selected.forEach((resourceId) => used.add(resourceId)); assignments.push({ requirementId: requirement.id, resourceIds: selected, ...(requirement.label ? { requirementLabel: requirement.label } : {}) }); if (assign(index + 1)) return true; selected.forEach((resourceId) => used.delete(resourceId)); assignments.pop(); return false; };
    if (assign(0)) slots.push({ startsAt, endsAt, assignments });
  }
  return { slots, rejected: [...rejected.entries()].map(([requirementId, reason]) => ({ requirementId, reason })) };
}
