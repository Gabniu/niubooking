// Ownership: shared booking API contract for staff schedule and future guest flow.

import type { BookingStatus } from "@bookingapp/domain";

export interface BookingSummary { id: string; tenantId: string; customerId: string; serviceName: string; startsAt: string; endsAt: string; status: BookingStatus; resourceIds?: readonly string[]; }
export interface BookingsResponse { data: readonly BookingSummary[] | null; error: { code: "UNAUTHENTICATED" | "TENANT_ACCESS_DENIED" | "BOOKINGS_UNAVAILABLE"; message: string } | null; }
export interface BookingResponse { data: BookingSummary | null; error: { code: "BOOKING_INVALID" | "BOOKING_NOT_FOUND" | "BOOKINGS_UNAVAILABLE" | "TENANT_ACCESS_DENIED"; message: string } | null; }
export interface PublicBookingRequirementAssignment { requirementId: string; resourceIds: readonly string[]; }
export interface PublicBookingHold { holdId: string; holdToken: string; serviceName: string; startsAt: string; endsAt: string; expiresAt: string; resourceIds?: readonly string[]; requirementAssignments?: readonly PublicBookingRequirementAssignment[]; }
export interface PublicBookingHoldResponse { data: PublicBookingHold | null; error: { code: "QR_NOT_FOUND" | "QR_INACTIVE" | "QR_EXPIRED" | "BOOKING_INVALID" | "BOOKINGS_UNAVAILABLE"; message: string } | null; }
export interface PublicBookingConfirmationResponse { data: (BookingSummary & { manageToken: string }) | null; error: { code: "QR_NOT_FOUND" | "QR_INACTIVE" | "QR_EXPIRED" | "BOOKING_INVALID" | "BOOKING_HOLD_EXPIRED" | "BOOKING_HOLD_INVALID" | "BOOKINGS_UNAVAILABLE"; message: string } | null; }
export interface PublicManageBookingResponse { data: BookingSummary | null; error: { code: "MANAGE_NOT_FOUND" | "MANAGE_INVALID" | "BOOKING_CONFLICT" | "BOOKINGS_UNAVAILABLE"; message: string } | null; }
