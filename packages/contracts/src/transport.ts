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

export interface PublicTransportTicketSummary {
  routeName: string;
  mode: TransportMode;
  originStopId: string;
  destinationStopId: string;
  quantity: number;
  seatLabels?: readonly string[];
  reservationStatus: ReservationStatus;
  status: "issued" | "cancelled";
  fareAmountMinor: number;
  fareCurrency: string;
  issuedAt: string;
  boardingStartsAt: string;
  boardingEndsAt: string;
}

export interface PublicTransportTicketResponse {
  data: PublicTransportTicketSummary | null;
  error: { code: "TRANSPORT_UNAVAILABLE" | "TRANSPORT_TICKET_NOT_FOUND"; message: string } | null;
}

export interface TransportRouteSummary {
  id: string;
  tenantId: string;
  version: number;
  name: string;
  mode: TransportMode;
  status: "draft" | "published" | "archived";
  stops: readonly PublicTransportStopSummary[];
}

export interface TransportTripSummary {
  id: string;
  tenantId: string;
  routeId: string;
  routeVersion: number;
  occurrenceId: string;
  capacityMode: CapacityMode;
  capacity: number;
  reservedQuantity?: number;
  boardingStartsAt: string;
  boardingEndsAt: string;
  vehicleResourceId?: string | null;
}

export interface TransportReservationSummary {
  id: string;
  tenantId: string;
  tripId: string;
  occurrenceId: string;
  customerId: string;
  originStopId: string;
  destinationStopId: string;
  quantity: number;
  status: ReservationStatus;
  seatLabels?: readonly string[];
}

export interface TransportTicketSummary {
  id: string;
  tenantId: string;
  tripId: string;
  reservationId: string;
  fareAmountMinor: number;
  fareCurrency: string;
  status: "issued" | "cancelled";
  issuedAt: string;
}

export interface TransportManifestSummary {
  reservation: TransportReservationSummary;
  ticket: TransportTicketSummary | null;
}

export interface TransportRoutesResponse {
  data: readonly TransportRouteSummary[] | null;
  error: { code: "TENANT_ACCESS_DENIED" | "TRANSPORT_UNAVAILABLE"; message: string } | null;
}

export interface TransportRouteResponse {
  data: TransportRouteSummary | null;
  error: { code: "TENANT_ACCESS_DENIED" | "TRANSPORT_UNAVAILABLE" | "TRANSPORT_ROUTE_INVALID"; message: string } | null;
}

export interface TransportTripsResponse {
  data: readonly TransportTripSummary[] | null;
  error: { code: "TENANT_ACCESS_DENIED" | "TRANSPORT_UNAVAILABLE" | "TRANSPORT_TRIP_INVALID"; message: string } | null;
}

export interface TransportTripResponse {
  data: TransportTripSummary | null;
  error: { code: "TENANT_ACCESS_DENIED" | "TRANSPORT_UNAVAILABLE" | "TRANSPORT_TRIP_INVALID"; message: string } | null;
}

export interface TransportManifestResponse {
  data: readonly TransportManifestSummary[] | null;
  error: { code: "TENANT_ACCESS_DENIED" | "TRANSPORT_UNAVAILABLE"; message: string } | null;
}

export interface TransportBoardingResponse {
  data: { id: string; tenantId: string; tripId: string; reservationId: string; ticketId: string; action: "boarded"; idempotencyKey: string; boardedAt: string } | null;
  error: { code: "TENANT_ACCESS_DENIED" | "TRANSPORT_UNAVAILABLE" | "TRANSPORT_BOARDING_INVALID" | "TRANSPORT_BOARDING_CONFLICT"; message: string } | null;
}

export interface TransportSeatAssignmentResponse {
  data: TransportReservationSummary | null;
  error: { code: "TENANT_ACCESS_DENIED" | "TRANSPORT_UNAVAILABLE" | "TRANSPORT_SEAT_INVALID" | "TRANSPORT_SEAT_CONFLICT"; message: string } | null;
}
