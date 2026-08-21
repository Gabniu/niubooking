// Ownership: versioned driver-ingest and privacy-safe realtime projection contracts.

import type { PositionFreshness } from "@bookingapp/domain";
import type { PublicTransportRouteGeometry, PublicTransportStopSummary } from "./transport.js";

export interface DriverPositionUpload {
  readonly sessionId: string;
  readonly eventId: string;
  readonly sequence: number;
  readonly capturedAt: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMetres: number;
  readonly speedMetresPerSecond?: number;
  readonly headingDegrees?: number;
  readonly batteryPercent?: number;
  readonly provider?: string;
  readonly appVersion?: string;
}

export interface DriverPositionReceipt {
  readonly data: {
    readonly eventId: string;
    readonly decision: "advance_current" | "history_only";
    readonly receivedAt: string;
  } | null;
  readonly error: {
    readonly code:
      | "TRACKING_UNAUTHENTICATED"
      | "TRACKING_SESSION_INACTIVE"
      | "POSITION_INVALID"
      | "POSITION_RATE_LIMITED";
    readonly message: string;
  } | null;
}

export interface LiveVehicleProjection {
  readonly tripId: string;
  readonly branchId: string;
  readonly vehicleLabel: string;
  readonly routeLabel: string;
  readonly capturedAt: string | null;
  readonly freshness: PositionFreshness;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accuracyMetres: number | null;
  readonly headingDegrees: number | null;
  /** Published route context is safe for staff map rendering and remains optional for older projections. */
  readonly geometry?: PublicTransportRouteGeometry | null;
  readonly stops?: readonly PublicTransportStopSummary[];
  readonly eta: {
    readonly earliestArrival: string;
    readonly latestArrival: string;
    readonly confidence: "low" | "medium" | "high";
  } | null;
}

export interface StaffLiveFleetResponse {
  readonly data: readonly LiveVehicleProjection[] | null;
  readonly error: {
    readonly code: "UNAUTHENTICATED" | "FLEET_ACCESS_DENIED" | "LIVE_FLEET_UNAVAILABLE";
    readonly message: string;
  } | null;
}

export interface FleetStreamEvent {
  readonly type: "snapshot" | "changed";
  readonly version: number;
  readonly response: StaffLiveFleetResponse;
}

export interface FleetCrewAssignmentStatus {
  readonly assignmentId: string;
  readonly branchId: string;
  readonly tripId: string;
  readonly role: "driver" | "conductor";
  readonly status: "active" | "ended";
  readonly assignedAt: string;
  readonly endedAt: string | null;
  readonly activeSession: {
    readonly id: string;
    readonly vehicleResourceId: string;
    readonly status: "active";
    readonly startedAt: string;
    readonly expiresAt: string;
  } | null;
}

export interface FleetCrewStatusResponse {
  readonly data: readonly FleetCrewAssignmentStatus[] | null;
  readonly error: {
    readonly code: "UNAUTHENTICATED" | "FLEET_ACCESS_DENIED" | "LIVE_FLEET_UNAVAILABLE";
    readonly message: string;
  } | null;
}

export interface RiderLiveTripProjection {
  readonly tripId: string;
  readonly routeLabel: string;
  readonly capturedAt: string | null;
  readonly freshness: PositionFreshness;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accuracyMetres: number | null;
  readonly headingDegrees: number | null;
  readonly eta: LiveVehicleProjection["eta"];
}

export interface RiderLiveStreamEvent {
  readonly type: "snapshot" | "changed";
  readonly version: number;
  readonly response: RiderLiveTripResponse;
}

export interface RiderLiveViewerSession {
  readonly viewerToken: string;
  readonly expiresAt: string;
}

export interface RiderLiveViewerSessionResponse {
  readonly data: RiderLiveViewerSession | null;
  readonly error: {
    readonly code: "TRACKING_LINK_INVALID" | "LIVE_TRIP_UNAVAILABLE";
    readonly message: string;
  } | null;
}

export interface RiderLiveTripResponse {
  readonly data: RiderLiveTripProjection | null;
  readonly error: {
    readonly code: "TRACKING_LINK_INVALID" | "TRACKING_LINK_EXPIRED" | "TRACKING_SESSION_REQUIRED" | "LIVE_TRIP_UNAVAILABLE";
    readonly message: string;
  } | null;
}
