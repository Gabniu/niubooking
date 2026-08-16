// Ownership: transport-neutral occurrence and reservation HTTP contract.

import type { OccurrenceStatus, ReservationStatus } from "@bookingapp/domain";

export interface OccurrenceSummary {
  id: string;
  tenantId: string;
  serviceId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  status: OccurrenceStatus;
  capacity: number | null;
  reservedQuantity: number;
}

export interface ReservationSummary {
  id: string;
  tenantId: string;
  occurrenceId: string;
  customerId: string;
  quantity: number;
  status: ReservationStatus;
}

export interface OccurrencesResponse {
  data: readonly OccurrenceSummary[] | null;
  error: { code: "TENANT_ACCESS_DENIED" | "OCCURRENCES_UNAVAILABLE"; message: string } | null;
}

export interface OccurrenceResponse {
  data: OccurrenceSummary | null;
  error: { code: "OCCURRENCE_INVALID" | "OCCURRENCES_UNAVAILABLE" | "TENANT_ACCESS_DENIED"; message: string } | null;
}

export interface PublicOccurrenceSummary {
  id: string;
  serviceId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  remainingCapacity: number | null;
}

export interface PublicOccurrencesResponse {
  data: readonly PublicOccurrenceSummary[] | null;
  error: { code: "QR_NOT_FOUND" | "QR_INACTIVE" | "QR_EXPIRED" | "OCCURRENCE_INVALID" | "OCCURRENCES_UNAVAILABLE"; message: string } | null;
}

export interface ReservationResponse {
  data: ReservationSummary | null;
  error: { code: "OCCURRENCE_INVALID" | "OCCURRENCE_FULL" | "RESERVATION_CONFLICT" | "RESERVATIONS_UNAVAILABLE"; message: string } | null;
}

export interface ReservationsResponse {
  data: readonly ReservationSummary[] | null;
  error: { code: "TENANT_ACCESS_DENIED" | "OCCURRENCE_INVALID" | "RESERVATIONS_UNAVAILABLE"; message: string } | null;
}

export interface ReservationStatusResponse {
  data: ReservationSummary | null;
  error: { code: "TENANT_ACCESS_DENIED" | "OCCURRENCE_INVALID" | "RESERVATION_CONFLICT" | "RESERVATIONS_UNAVAILABLE"; message: string } | null;
}

export interface PublicOccurrenceReservationResponse {
  data: { reservationId: string; occurrenceId: string; quantity: number; status: "confirmed" } | null;
  error: { code: "QR_NOT_FOUND" | "QR_INACTIVE" | "QR_EXPIRED" | "OCCURRENCE_INVALID" | "OCCURRENCE_FULL" | "RESERVATION_CONFLICT" | "RESERVATIONS_UNAVAILABLE"; message: string } | null;
}
