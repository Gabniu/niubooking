// Ownership: typed service composition responses shared by API and web.

import type { ServiceRequirement, ServiceVariant } from "@bookingapp/domain";

export interface ServiceVariantsResponse { data: readonly ServiceVariant[] | null; error: { code: "SERVICE_NOT_FOUND" | "SERVICE_VARIANTS_UNAVAILABLE" | "TENANT_ACCESS_DENIED"; message: string } | null; }
export interface ServiceRequirementsResponse { data: readonly ServiceRequirement[] | null; error: { code: "SERVICE_NOT_FOUND" | "SERVICE_REQUIREMENTS_UNAVAILABLE" | "TENANT_ACCESS_DENIED"; message: string } | null; }
export interface ServiceVariantResponse { data: ServiceVariant | null; error: { code: "SERVICE_INVALID" | "SERVICE_VARIANT_NOT_FOUND" | "SERVICE_VARIANTS_UNAVAILABLE" | "TENANT_ACCESS_DENIED"; message: string } | null; }
export interface ServiceRequirementResponse { data: ServiceRequirement | null; error: { code: "SERVICE_INVALID" | "SERVICE_REQUIREMENT_NOT_FOUND" | "SERVICE_REQUIREMENTS_UNAVAILABLE" | "TENANT_ACCESS_DENIED"; message: string } | null; }
