// Ownership: immutable-at-runtime registry of code-reviewed pack manifests.

import { INDUSTRY_PACK_FIXTURES } from "./industry-pack-fixtures.js";
import { validateIndustryPackManifest, type IndustryPackManifest } from "./industry-packs.js";

export interface IndustryPackRegistry { list(): readonly IndustryPackManifest[]; read(id: string, version?: string): IndustryPackManifest | null; register(pack: IndustryPackManifest): void; }
function compareVersions(left: string, right: string): number { const a = left.split(".").map(Number); const b = right.split(".").map(Number); return (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0) || (a[2] ?? 0) - (b[2] ?? 0); }
export function createIndustryPackRegistry(initial: readonly IndustryPackManifest[] = []): IndustryPackRegistry {
  const packs = new Map<string, IndustryPackManifest[]>();
  const register = (pack: IndustryPackManifest): void => { const errors = validateIndustryPackManifest(pack); if (errors.length) throw new Error(errors.join("; ")); const versions = packs.get(pack.id) ?? []; if (versions.some((value) => value.version === pack.version)) throw new Error(`Pack ${pack.id}@${pack.version} is already registered`); packs.set(pack.id, [...versions, pack].sort((left, right) => compareVersions(right.version, left.version))); };
  for (const pack of initial) register(pack);
  return { register, list: () => [...packs.values()].map((versions) => versions[0]).filter((pack): pack is IndustryPackManifest => Boolean(pack)).sort((left, right) => left.displayName.localeCompare(right.displayName)), read: (id, version) => { const versions = packs.get(id) ?? []; return versions.find((pack) => !version || pack.version === version) ?? null; } };
}
export const defaultIndustryPackRegistry = createIndustryPackRegistry(INDUSTRY_PACK_FIXTURES);
