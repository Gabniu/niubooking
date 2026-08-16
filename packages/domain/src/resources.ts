// Ownership: universal schedulable-resource identity. Industry packs refine resourceType, not the core lifecycle.

export type ResourceStatus = "active" | "inactive";
export interface Resource { id: string; tenantId: string; name: string; resourceType: string; capabilities?: readonly string[]; status: ResourceStatus; }
export interface ResourceDraft { id: string; tenantId: string; name: string; resourceType: string; capabilities?: readonly string[]; }

export function validateResourceDraft(resource: ResourceDraft): string[] {
  const errors: string[] = [];
  if (!resource.id || !resource.tenantId) errors.push("Resource identity is required");
  if (!resource.name.trim() || resource.name.trim().length > 200) errors.push("Resource name must be between 1 and 200 characters");
  if (!resource.resourceType.trim() || resource.resourceType.trim().length > 100) errors.push("Resource type must be between 1 and 100 characters");
  const capabilities = resource.capabilities ?? []; if (capabilities.length > 32 || capabilities.some((capability) => !capability.trim() || capability.trim().length > 100)) errors.push("Resource capabilities must contain at most 32 bounded labels"); if (new Set(capabilities.map((capability) => capability.trim())).size !== capabilities.length) errors.push("Resource capabilities must be unique");
  return errors;
}
