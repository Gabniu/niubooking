// Ownership: typed tenant service catalog responses shared by API and web.

import type { ServiceBookingMode, ServiceStatus } from "@bookingapp/domain";
export interface ServiceSummary { id: string; tenantId: string; name: string; description: string | null; bookingMode: ServiceBookingMode; durationMinutes: number; bufferBeforeMinutes: number; bufferAfterMinutes: number; priceCents: number | null; currency: string | null; packId: string | null; status: ServiceStatus; }
export interface ServicesResponse { data: readonly ServiceSummary[] | null; error: { code: "UNAUTHENTICATED" | "TENANT_ACCESS_DENIED" | "SERVICES_UNAVAILABLE"; message: string } | null; }
export interface ServiceResponse { data: ServiceSummary | null; error: { code: "SERVICE_INVALID" | "SERVICE_NOT_FOUND" | "SERVICES_UNAVAILABLE" | "TENANT_ACCESS_DENIED"; message: string } | null; }
