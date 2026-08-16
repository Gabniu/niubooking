// Ownership: deterministic pack-to-catalog planning; persistence executes this plan transactionally.

import { validateIndustryPackManifest, type IndustryPackManifest } from "./industry-packs.js";
import type { ServiceDefinitionDraft } from "./services.js";
import type { ServiceRequirementDraft, ServiceVariantDraft } from "./service-variants.js";

export interface IndustryPackMaterializationPlan { packId: string; packVersion: string; services: readonly ServiceDefinitionDraft[]; variants: readonly ServiceVariantDraft[]; requirements: readonly ServiceRequirementDraft[]; }
function id(tenantId: string, packId: string, templateId: string, suffix: string): string { return `${tenantId}::${packId}::${templateId}::${suffix}`; }
export function buildIndustryPackMaterializationPlan(pack: IndustryPackManifest, tenantId: string): IndustryPackMaterializationPlan {
  const errors = validateIndustryPackManifest(pack); if (!tenantId.trim()) throw new Error("Tenant identity is required"); if (errors.length) throw new Error(errors.join("; "));
  const services: ServiceDefinitionDraft[] = []; const variants: ServiceVariantDraft[] = []; const requirements: ServiceRequirementDraft[] = [];
  for (const template of pack.serviceTemplates) { const serviceId = id(tenantId, pack.id, template.id, "service"); const variantId = id(tenantId, pack.id, template.id, "standard"); services.push({ id: serviceId, tenantId, name: template.name, bookingMode: template.bookingMode, durationMinutes: template.durationMinutes, packId: pack.id }); variants.push({ id: variantId, tenantId, serviceId, name: "Standard" }); template.requirements.forEach((requirement, index) => requirements.push({ id: id(tenantId, pack.id, template.id, `requirement-${index + 1}`), tenantId, serviceId, variantId, kind: requirement.kind, label: requirement.label, quantity: requirement.quantity, resourceType: requirement.resourceType ?? null, capabilityKey: requirement.capabilityKey ?? null })); }
  return { packId: pack.id, packVersion: pack.version, services, variants, requirements };
}
