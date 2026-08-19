// Ownership: public transport passenger HTTP contracts shared by API and Next.

import type { CapacityMode, ReservationStatus, TransportMode } from "@bookingapp/domain";

export interface PublicTransportStopSummary {
  stopId: string;
  sequence: number;
  boardingMinutes: number;
  alightingMinutes: number;
}

export interface PublicTransportTripSummary {
  id: string;
  routeName: string;
  mode: TransportMode;
  stops: readonly PublicTransportStopSummary[];
  capacityMode: CapacityMode;
  capacity: number;
  remainingCapacity: number;
  boardingStartsAt: string;
  boardingEndsAt: string;
}

export interface PublicTransportTripsResponse {
  data: readonly PublicTransportTripSummary[] | null;
  error: { code: "QR_NOT_FOUND" | "QR_INACTIVE" | "QR_EXPIRED" | "TRANSPORT_UNAVAILABLE" | "TRANSPORT_TRIP_INVALID"; message: string } | null;
}

export interface PublicTransportReservationResponse {
  data: { reservationId: string; tripId: string; originStopId: string; destinationStopId: string; quantity: number; status: Extract<ReservationStatus, "held" | "confirmed">; manageToken?: string } | null;
  error: { code: "QR_NOT_FOUND" | "QR_INACTIVE" | "QR_EXPIRED" | "TRANSPORT_UNAVAILABLE" | "TRANSPORT_RESERVATION_INVALID" | "TRANSPORT_CAPACITY_FULL"; message: string } | null;
}

export interface PublicTransportCancellationResponse {
  data: { reservationId: string; tripId: string; status: ReservationStatus } | null;
  error: { code: "TRANSPORT_UNAVAILABLE" | "TRANSPORT_CANCELLATION_INVALID" | "TRANSPORT_RESERVATION_NOT_FOUND" | "TRANSPORT_CANCELLATION_CONFLICT"; message: string } | null;
}
