// Ownership: tenant-scoped pack selection and bounded override responses.

import type { IndustryPackSelection } from "@bookingapp/domain";
export interface IndustryPackSelectionResponse { data: IndustryPackSelection | null; error: { code: "PACK_INVALID" | "PACK_NOT_FOUND" | "PACK_SETTINGS_UNAVAILABLE" | "TENANT_ACCESS_DENIED"; message: string } | null; }
