// Ownership: safe platform pack catalog response; executable modules never cross this boundary.

import type { IndustryPackManifest } from "@bookingapp/domain";
export interface IndustryPacksResponse { data: readonly Pick<IndustryPackManifest, "id" | "version" | "displayName" | "supportedLocales" | "theme" | "navigation" | "dashboards" | "resourceTypes" | "capabilities" | "serviceTemplates">[] | null; error: { code: "PACKS_UNAVAILABLE"; message: string } | null; }
