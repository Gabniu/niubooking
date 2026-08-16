// Ownership: code-reviewed industry-pack contracts; tenant data cannot inject executable modules.

export interface PackResourceType { id: string; label: string; }
export interface PackCapability { id: string; label: string; }
export interface PackRequirementTemplate { kind: "resource"; label: string; quantity: number; resourceType?: string; capabilityKey?: string; }
export interface PackServiceTemplate { id: string; name: string; bookingMode: "appointment" | "occurrence"; durationMinutes: number; requirements: readonly PackRequirementTemplate[]; }
export interface PackNavigationItem { id: string; label: string; href: string; }
export interface PackDashboardDefinition { id: string; title: string; metricIds: readonly string[]; }
export interface PackTheme { accent: string; accentSoft: string; }
export interface IndustryPackOverrides { terminology?: Readonly<Record<string, string>>; theme?: Partial<PackTheme>; }
export interface IndustryPackSelection { tenantId: string; packId: string; packVersion: string; overrides: IndustryPackOverrides; }
export interface IndustryPackManifest {
  id: string; version: string; schemaVersion: 1; displayName: string; supportedLocales: readonly string[];
  terminology: Readonly<Record<string, string>>; theme: PackTheme; navigation: readonly PackNavigationItem[]; dashboards: readonly PackDashboardDefinition[];
  resourceTypes: readonly PackResourceType[]; serviceTemplates: readonly PackServiceTemplate[]; capabilities: readonly PackCapability[];
  workflows: readonly { id: string; states: readonly string[] }[]; forms: readonly { id: string; title: string }[]; outcomes: readonly { id: string; label: string }[];
  permissions: readonly { id: string; operation: string }[]; automations: readonly { id: string; event: string }[]; reports: readonly { id: string; title: string }[];
  migrations: readonly { id: string; fromVersion: string; toVersion: string }[];
}

const idPattern = /^[a-z][a-z0-9.-]{2,80}$/u;
const versionPattern = /^\d+\.\d+\.\d+$/u;
const colorPattern = /^#[0-9a-f]{6}$/iu;
const internalHrefPattern = /^\.\/[a-z0-9-]+\.html(?:\?.*)?$/u;
function uniqueIds(values: readonly { id: string }[], label: string, errors: string[]): void { const ids = new Set<string>(); for (const value of values) { if (!idPattern.test(value.id)) errors.push(`${label} id is invalid: ${value.id}`); if (ids.has(value.id)) errors.push(`${label} id is duplicated: ${value.id}`); ids.add(value.id); } }
function hasValue(values: readonly { id: string }[], id: string | undefined): boolean { return Boolean(id && values.some((value) => value.id === id)); }
export function validateIndustryPackOverrides(pack: IndustryPackManifest, overrides: IndustryPackOverrides): string[] { const errors: string[] = []; const terms = overrides.terminology ?? {}; const theme = overrides.theme ?? {}; if (Object.keys(terms).length > 24) errors.push("Pack terminology overrides are limited to 24 fields"); for (const [key, value] of Object.entries(terms)) { if (!(key in pack.terminology)) errors.push(`Terminology override is not allowed: ${key}`); if (!value.trim() || value.length > 120) errors.push(`Terminology override is invalid: ${key}`); } for (const [key, value] of Object.entries(theme)) { if (key !== "accent" && key !== "accentSoft") errors.push(`Theme override is not allowed: ${key}`); if (value !== undefined && !colorPattern.test(value)) errors.push(`Theme override is not a six-digit hex color: ${key}`); } return errors; }
export function resolveIndustryPack(pack: IndustryPackManifest, overrides: IndustryPackOverrides = {}): IndustryPackManifest { const errors = validateIndustryPackOverrides(pack, overrides); if (errors.length) throw new Error(errors.join("; ")); return { ...pack, terminology: { ...pack.terminology, ...(overrides.terminology ?? {}) }, theme: { ...pack.theme, ...(overrides.theme ?? {}) } }; }

export function validateIndustryPackManifest(pack: IndustryPackManifest): string[] {
  const errors: string[] = [];
  if (!idPattern.test(pack.id)) errors.push("Pack id must be a stable namespaced identifier");
  if (!versionPattern.test(pack.version)) errors.push("Pack version must use semantic major.minor.patch format");
  if (pack.schemaVersion !== 1) errors.push("Pack schema version is unsupported");
  if (!pack.displayName.trim() || pack.displayName.length > 120) errors.push("Pack display name is required and bounded");
  if (!pack.supportedLocales.length) errors.push("Pack must support at least one locale");
  if (!colorPattern.test(pack.theme.accent) || !colorPattern.test(pack.theme.accentSoft)) errors.push("Pack theme colors must be six-digit hex values");
  uniqueIds(pack.resourceTypes, "Resource type", errors); uniqueIds(pack.capabilities, "Capability", errors); uniqueIds(pack.serviceTemplates, "Service template", errors);
  uniqueIds(pack.navigation, "Navigation", errors); uniqueIds(pack.dashboards, "Dashboard", errors); uniqueIds(pack.workflows, "Workflow", errors); uniqueIds(pack.forms, "Form", errors); uniqueIds(pack.outcomes, "Outcome", errors); uniqueIds(pack.permissions, "Permission", errors); uniqueIds(pack.automations, "Automation", errors); uniqueIds(pack.reports, "Report", errors); uniqueIds(pack.migrations, "Migration", errors);
  for (const item of pack.navigation) if (!internalHrefPattern.test(item.href)) errors.push(`Navigation ${item.id} must use an internal HTML path`);
  for (const template of pack.serviceTemplates) { if (!template.name.trim() || template.durationMinutes < 5 || template.durationMinutes > 1440) errors.push(`Service template ${template.id} has invalid timing or name`); if (template.requirements.length === 0) errors.push(`Service template ${template.id} needs at least one requirement`); for (const requirement of template.requirements) { if (requirement.kind !== "resource" || !Number.isInteger(requirement.quantity) || requirement.quantity < 1 || requirement.quantity > 16) errors.push(`Service template ${template.id} has an invalid requirement`); if (!hasValue(pack.resourceTypes, requirement.resourceType) && !hasValue(pack.capabilities, requirement.capabilityKey)) errors.push(`Service template ${template.id} references an unknown resource or capability`); } }
  return errors;
}
