// Ownership: typed resource inventory and advisory availability responses.

import type { ResourceStatus } from "@bookingapp/domain";

export interface ResourceSummary { id: string; tenantId: string; name: string; resourceType: string; capabilities?: readonly string[]; status: ResourceStatus; }
export interface ResourceSlot { startsAt: string; endsAt: string; resourceIds: readonly string[]; }
export interface ResourcesResponse { data: readonly ResourceSummary[] | null; error: { code: "UNAUTHENTICATED" | "TENANT_ACCESS_DENIED" | "RESOURCES_UNAVAILABLE"; message: string } | null; }
export interface ResourceResponse { data: ResourceSummary | null; error: { code: "RESOURCE_INVALID" | "RESOURCES_UNAVAILABLE" | "TENANT_ACCESS_DENIED"; message: string } | null; }
export interface AvailabilityResponse { data: readonly ResourceSlot[] | null; error: { code: "AVAILABILITY_INVALID" | "AVAILABILITY_UNAVAILABLE" | "QR_NOT_FOUND" | "QR_INACTIVE" | "QR_EXPIRED" | "TENANT_ACCESS_DENIED"; message: string } | null; }
