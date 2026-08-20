// Ownership: transport route and trip invariants layered on universal occurrences.

import type { ReservationStatus, ServiceOccurrence } from "./occurrence.js";

export type TransportMode = "bus" | "matatu" | "shuttle" | "charter";
export type CapacityMode = "seat" | "open";
export type TransportRouteStatus = "draft" | "published" | "archived";

export type TransportCoordinate = readonly [longitude: number, latitude: number];

export interface TransportRouteGeometry {
  type: "LineString";
  coordinates: readonly TransportCoordinate[];
}

export interface TransportStopRef {
  stopId: string;
  label?: string;
  sequence: number;
  boardingMinutes: number;
  alightingMinutes: number;
  latitude?: number;
  longitude?: number;
}

export interface TransportRoute {
  id: string;
  tenantId: string;
  version: number;
  name: string;
  mode: TransportMode;
  status: TransportRouteStatus;
  stops: readonly TransportStopRef[];
  geometry?: TransportRouteGeometry | null;
}

export type TransportRouteDraft = Omit<TransportRoute, "status"> & { status?: TransportRouteStatus };

export interface TransportTrip {
  id: string;
  tenantId: string;
  /** Null only for trips created before branch-scoped transport was introduced. */
  branchId: string | null;
  routeId: string;
  routeVersion: number;
  occurrenceId: string;
  capacityMode: CapacityMode;
  capacity: number;
  boardingStartsAt: Date;
  boardingEndsAt: Date;
  vehicleResourceId?: string | null;
  reservedQuantity?: number;
}

export type TransportTripDraft = Omit<TransportTrip, "reservedQuantity" | "branchId"> & { branchId: string };

export interface TransportPassengerReservation {
  id: string;
  tenantId: string;
  tripId: string;
  occurrenceId: string;
  customerId: string;
  originStopId: string;
  destinationStopId: string;
  quantity: number;
  status: ReservationStatus;
  /** Assigned labels are present for seat-mode trips after staff assignment. */
  seatLabels?: readonly string[];
  createIdempotencyKey?: string;
  /** Present only in the one-time public response that creates the reservation. */
  manageToken?: string;
}

export type TransportPassengerReservationDraft = Omit<TransportPassengerReservation, "status"> & { status?: ReservationStatus };

export interface TransportTicket {
  id: string;
  tenantId: string;
  tripId: string;
  reservationId: string;
  fareAmountMinor: number;
  fareCurrency: string;
  status: "issued" | "cancelled";
  issuedAt: Date;
  ticketToken?: string;
}

export interface TransportManifestEntry {
  reservation: TransportPassengerReservation;
  ticket: TransportTicket | null;
}

/** Public ticket view: journey details without tenant, vehicle, or customer identity. */
export interface PublicTransportTicket {
  routeName: string;
  mode: TransportMode;
  stops: readonly TransportStopRef[];
  geometry?: TransportRouteGeometry | null;
  originStopId: string;
  destinationStopId: string;
  quantity: number;
  seatLabels?: readonly string[];
  reservationStatus: ReservationStatus;
  status: TransportTicket["status"];
  fareAmountMinor: number;
  fareCurrency: string;
  issuedAt: Date;
  boardingStartsAt: Date;
  boardingEndsAt: Date;
}

export interface PublicTransportTrip {
  id: string;
  routeName: string;
  mode: TransportMode;
  stops: readonly TransportStopRef[];
  geometry?: TransportRouteGeometry | null;
  capacityMode: CapacityMode;
  capacity: number;
  remainingCapacity: number;
  boardingStartsAt: Date;
  boardingEndsAt: Date;
}

export interface TransportBoarding {
  id: string;
  tenantId: string;
  tripId: string;
  reservationId: string;
  ticketId: string;
  actorId: string | null;
  action: "boarded";
  idempotencyKey: string;
  boardedAt: Date;
}

function validDate(value: Date): boolean { return Number.isFinite(value.getTime()); }

export function validateTransportRouteDraft(draft: TransportRouteDraft): string[] {
  const errors: string[] = [];
  if (!draft.id || !draft.tenantId) errors.push("Route identity is required");
  if (!draft.name.trim() || draft.name.trim().length > 200) errors.push("Route name must be between 1 and 200 characters");
  if (!Number.isInteger(draft.version) || draft.version < 1) errors.push("Route version must be a positive integer");
  if (draft.status && !["draft", "published", "archived"].includes(draft.status)) errors.push("Route status is invalid");
  if (draft.stops.length < 2) errors.push("A route needs at least two stops");
  const sequences = draft.stops.map((stop) => stop.sequence);
  const stopIds = draft.stops.map((stop) => stop.stopId);
  if (new Set(stopIds).size !== stopIds.length) errors.push("A route cannot repeat a stop");
  if (new Set(sequences).size !== sequences.length || sequences.some((sequence, index) => sequence !== index + 1)) errors.push("Route stops must use consecutive sequence numbers");
  if (draft.stops.some((stop) => !stop.stopId || (stop.label !== undefined && (!stop.label.trim() || stop.label.trim().length > 200)) || !Number.isInteger(stop.boardingMinutes) || stop.boardingMinutes < 0 || !Number.isInteger(stop.alightingMinutes) || stop.alightingMinutes < 0 || !validStopCoordinate(stop))) errors.push("Stops need valid labels, times, and paired coordinates");
  if (draft.geometry !== undefined && draft.geometry !== null && !validRouteGeometry(draft.geometry)) errors.push("Route geometry must be a bounded LineString with valid coordinates");
  return errors;
}

function validStopCoordinate(stop: Pick<TransportStopRef, "latitude" | "longitude">): boolean {
  const hasLatitude = stop.latitude !== undefined;
  const hasLongitude = stop.longitude !== undefined;
  if (!hasLatitude && !hasLongitude) return true;
  return hasLatitude && hasLongitude && Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude) && stop.latitude! >= -90 && stop.latitude! <= 90 && stop.longitude! >= -180 && stop.longitude! <= 180;
}

export function validRouteGeometry(geometry: TransportRouteGeometry): boolean {
  return geometry.type === "LineString" && geometry.coordinates.length >= 2 && geometry.coordinates.length <= 10_000 && geometry.coordinates.every(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90);
}

export function validateTransportTripDraft(draft: TransportTripDraft, route: Pick<TransportRoute, "id" | "tenantId" | "version">, occurrence: Pick<ServiceOccurrence, "id" | "tenantId" | "startsAt" | "endsAt">): string[] {
  const errors: string[] = [];
  if (!draft.id || !draft.tenantId || !draft.branchId || !draft.routeId || !draft.occurrenceId) errors.push("Trip and branch identity are required");
  if (draft.tenantId !== route.tenantId || draft.tenantId !== occurrence.tenantId) errors.push("Trip, route, and occurrence must share a tenant");
  if (draft.routeId !== route.id || draft.routeVersion !== route.version) errors.push("Trip route version is not current");
  if (draft.occurrenceId !== occurrence.id) errors.push("Trip occurrence does not match the supplied occurrence");
  if (!Number.isInteger(draft.capacity) || draft.capacity <= 0) errors.push("Trip capacity must be a positive integer");
  if (!validDate(draft.boardingStartsAt) || !validDate(draft.boardingEndsAt) || draft.boardingEndsAt <= draft.boardingStartsAt) errors.push("Boarding window must be valid and end after it starts");
  if (validDate(draft.boardingStartsAt) && draft.boardingStartsAt < occurrence.startsAt) errors.push("Boarding cannot start before the occurrence");
  if (validDate(draft.boardingEndsAt) && draft.boardingEndsAt > occurrence.endsAt) errors.push("Boarding cannot end after the occurrence");
  return errors;
}

export function validateTransportPassengerReservationDraft(draft: TransportPassengerReservationDraft, trip: Pick<TransportTrip, "id" | "tenantId" | "occurrenceId" | "capacity" | "reservedQuantity">, stops: readonly TransportStopRef[]): string[] {
  const errors: string[] = [];
  if (!draft.id || !draft.tenantId || !draft.tripId || !draft.occurrenceId || !draft.customerId) errors.push("Passenger and trip identity are required");
  if (draft.tenantId !== trip.tenantId || draft.tripId !== trip.id || draft.occurrenceId !== trip.occurrenceId) errors.push("Passenger, trip, and occurrence must share the same journey");
  if (!Number.isInteger(draft.quantity) || draft.quantity <= 0) errors.push("Passenger quantity must be a positive integer");
  if (trip.reservedQuantity !== undefined && draft.quantity + trip.reservedQuantity > trip.capacity) errors.push("Trip capacity is unavailable");
  if (!draft.originStopId || !draft.destinationStopId || draft.originStopId === draft.destinationStopId) errors.push("Choose different boarding and arrival stops");
  const origin = stops.find((stop) => stop.stopId === draft.originStopId);
  const destination = stops.find((stop) => stop.stopId === draft.destinationStopId);
  if (!origin || !destination || origin.sequence >= destination.sequence) errors.push("Boarding stop must come before arrival stop");
  if (draft.createIdempotencyKey !== undefined && (draft.createIdempotencyKey.trim().length < 8 || draft.createIdempotencyKey.trim().length > 200)) errors.push("Reservation retry key must be between 8 and 200 characters");
  if (draft.status && !["held", "confirmed"].includes(draft.status)) errors.push("New passenger reservations must be held or confirmed");
  return errors;
}

export function validateTransportSeatAssignment(input: { capacityMode: CapacityMode; capacity: number; quantity: number; seatLabels: readonly string[] }): string[] {
  const errors: string[] = [];
  if (input.capacityMode !== "seat") errors.push("Only seat-based trips can assign seats");
  if (!Number.isInteger(input.capacity) || input.capacity < 1) errors.push("Trip capacity must be a positive integer");
  if (!Number.isInteger(input.quantity) || input.quantity < 1) errors.push("Passenger quantity must be a positive integer");
  if (input.seatLabels.length !== input.quantity) errors.push("Choose one seat for each passenger");
  if (new Set(input.seatLabels).size !== input.seatLabels.length) errors.push("A passenger cannot use the same seat twice");
  if (input.seatLabels.some((label) => !/^[1-9]\d{0,3}$/u.test(label) || Number(label) > input.capacity)) errors.push("Choose seats within the trip capacity");
  return errors;
}

export function validateTransportTicketDraft(draft: Pick<TransportTicket, "id" | "tenantId" | "tripId" | "reservationId" | "fareAmountMinor" | "fareCurrency">): string[] {
  const errors: string[] = [];
  if (!draft.id || !draft.tenantId || !draft.tripId || !draft.reservationId) errors.push("Ticket identity is required");
  if (!Number.isInteger(draft.fareAmountMinor) || draft.fareAmountMinor < 0) errors.push("Fare must be a whole number of minor currency units");
  if (!/^[A-Z]{3}$/.test(draft.fareCurrency)) errors.push("Fare currency must be a three-letter code");
  return errors;
}
