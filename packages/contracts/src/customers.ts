// Ownership: shared customer profile contract for staff operations and future booking flows.

export type CustomerProfileStatus = "active" | "archived";
export interface CustomerProfileSummary { id: string; tenantId: string; displayName: string; preferredLocale: string | null; timezone: string | null; status: CustomerProfileStatus; }
export interface CustomerProfilesResponse { data: readonly CustomerProfileSummary[] | null; error: { code: "UNAUTHENTICATED" | "TENANT_ACCESS_DENIED" | "CUSTOMERS_UNAVAILABLE"; message: string } | null; }
export interface CustomerProfileResponse { data: CustomerProfileSummary | null; error: { code: "CUSTOMER_INVALID" | "CUSTOMER_NOT_FOUND" | "CUSTOMERS_UNAVAILABLE" | "TENANT_ACCESS_DENIED" | "UNAUTHENTICATED"; message: string } | null; }
export interface CustomerStatusResponse { data: { customerId: string; status: CustomerProfileStatus } | null; error: { code: "CUSTOMER_INVALID" | "CUSTOMER_NOT_FOUND" | "CUSTOMERS_UNAVAILABLE" | "TENANT_ACCESS_DENIED"; message: string } | null; }
