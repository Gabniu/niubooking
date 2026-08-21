// Ownership: typed staff/public contracts for GTFS readiness and publication.

import type { GtfsScheduleFeature } from "@bookingapp/domain";

export type GtfsFeedLifecycle = "draft" | "validating" | "ready" | "published" | "failed" | "withdrawn";
export type GtfsValidationSeverity = "error" | "warning" | "info";

export interface GtfsValidationIssue {
  readonly code: string;
  readonly severity: GtfsValidationSeverity;
  readonly file?: string;
  readonly entityPublicId?: string;
  readonly message: string;
  readonly suggestedAction?: string;
}

export interface GtfsFeatureReadiness {
  readonly feature: GtfsScheduleFeature | "realtime_vehicle_positions" | "realtime_trip_updates" | "realtime_alerts" | "realtime_detours";
  readonly state: "not_configured" | "incomplete" | "ready" | "enabled" | "degraded";
  readonly blockingIssueCount: number;
  readonly warningCount: number;
}

export interface GtfsFeedVersionSummary {
  readonly id: string;
  readonly version: string;
  readonly lifecycle: GtfsFeedLifecycle;
  readonly createdAt: string;
  readonly validatedAt: string | null;
  readonly publishedAt: string | null;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly issueCounts: Readonly<Record<GtfsValidationSeverity, number>>;
}

export interface GtfsPublicationStatus {
  readonly organizationId: string;
  readonly publicScheduleUrl: string | null;
  readonly publicVehiclePositionsUrl: string | null;
  readonly publicTripUpdatesUrl: string | null;
  readonly publicAlertsUrl: string | null;
  readonly activeSchedule: GtfsFeedVersionSummary | null;
  readonly latestCandidate: GtfsFeedVersionSummary | null;
  readonly versions: readonly GtfsFeedVersionSummary[];
  readonly features: readonly GtfsFeatureReadiness[];
  readonly lastRealtimeObservationAt: string | null;
  readonly realtimeState: "disabled" | "healthy" | "delayed" | "stale";
}

export interface GtfsPublicationStatusResponse {
  readonly data: GtfsPublicationStatus | null;
  readonly error: {
    readonly code: "UNAUTHENTICATED" | "GTFS_ACCESS_DENIED" | "GTFS_NOT_CONFIGURED" | "GTFS_UNAVAILABLE";
    readonly message: string;
  } | null;
}

export type GtfsAlertStatus = "draft" | "published" | "withdrawn";
export interface GtfsAlertRecord {
  readonly entityPublicId: string;
  readonly tenantId: string;
  readonly feedVersionId: string;
  readonly headerText: string;
  readonly descriptionText?: string;
  readonly activeFrom?: string;
  readonly activeUntil?: string;
  readonly routePublicIds?: readonly string[];
  readonly stopPublicIds?: readonly string[];
  readonly tripPublicIds?: readonly string[];
  readonly status: GtfsAlertStatus;
  readonly createdAt: string;
}

export interface GtfsAlertsResponse { readonly data: readonly GtfsAlertRecord[] | null; readonly error: { readonly code: string; readonly message: string } | null; }

export interface GtfsValidationReportResponse {
  readonly data: {
    readonly feedVersionId: string;
    readonly issues: readonly GtfsValidationIssue[];
    readonly canPublish: boolean;
  } | null;
  readonly error: {
    readonly code: "GTFS_ACCESS_DENIED" | "GTFS_VERSION_NOT_FOUND" | "GTFS_VALIDATION_UNAVAILABLE";
    readonly message: string;
  } | null;
}

export interface GtfsPublicationCommand {
  readonly feedVersionId: string;
  readonly action: "validate" | "publish" | "withdraw" | "rollback";
  readonly idempotencyKey: string;
}

export interface GtfsPublicationCommandResponse {
  readonly data: { readonly feedVersion: GtfsFeedVersionSummary } | null;
  readonly error: {
    readonly code:
      | "UNAUTHENTICATED"
      | "GTFS_COMMAND_INVALID"
      | "GTFS_COMMAND_UNAVAILABLE"
      | "GTFS_ACCESS_DENIED"
      | "GTFS_VERSION_NOT_FOUND"
      | "GTFS_VALIDATION_REQUIRED"
      | "GTFS_BLOCKING_ISSUES"
      | "GTFS_VERSION_CONFLICT";
    readonly message: string;
  } | null;
}

export interface GtfsPublicationGenerationResponse {
  readonly data: { readonly feedVersion: GtfsFeedVersionSummary } | null;
  readonly error: {
    readonly code: "UNAUTHENTICATED" | "GTFS_ACCESS_DENIED" | "GTFS_GENERATION_INVALID" | "GTFS_GENERATION_UNAVAILABLE" | "GTFS_VERSION_NOT_FOUND";
    readonly message: string;
  } | null;
}
