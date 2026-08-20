// Ownership: privacy-safe GTFS-Realtime references and freshness validation.

import { isValidGtfsPublicId } from "./gtfs-schedule.js";

export type GtfsRealtimeScheduleRelationship =
  | "scheduled"
  | "added"
  | "unscheduled"
  | "canceled"
  | "duplicated";

export interface GtfsPublishedReferences {
  readonly scheduleVersion: string;
  readonly routeIds: ReadonlySet<string>;
  readonly tripIds: ReadonlySet<string>;
  readonly stopIds: ReadonlySet<string>;
}

export interface GtfsRealtimeTripDescriptor {
  readonly tripPublicId?: string;
  readonly routePublicId?: string;
  readonly startDate: string;
  readonly startTime?: string;
  readonly scheduleRelationship: GtfsRealtimeScheduleRelationship;
}

export interface GtfsRealtimeVehiclePosition {
  readonly entityPublicId: string;
  readonly vehiclePublicId: string;
  readonly trip: GtfsRealtimeTripDescriptor;
  readonly latitude: number;
  readonly longitude: number;
  readonly bearing?: number;
  readonly speedMetresPerSecond?: number;
  readonly capturedAt: Date;
  readonly currentStopSequence?: number;
  readonly stopPublicId?: string;
  readonly occupancyStatus?:
    | "empty"
    | "many_seats_available"
    | "few_seats_available"
    | "standing_room_only"
    | "crushed_standing_room_only"
    | "full"
    | "not_accepting_passengers";
}

export interface GtfsRealtimeTripUpdate {
  readonly entityPublicId: string;
  readonly trip: GtfsRealtimeTripDescriptor;
  readonly vehiclePublicId?: string;
  readonly capturedAt: Date;
  readonly stopUpdates: readonly {
    readonly stopPublicId: string;
    readonly stopSequence: number;
    readonly arrivalAt?: Date;
    readonly departureAt?: Date;
    readonly scheduleRelationship?: "scheduled" | "skipped" | "no_data" | "unscheduled";
  }[];
}

export interface GtfsRealtimeTripUpdatesFeed {
  readonly scheduleVersion: string;
  readonly generatedAt: Date;
  readonly entities: readonly GtfsRealtimeTripUpdate[];
}

export interface GtfsRealtimeAlert {
  readonly entityPublicId: string;
  readonly headerText: string;
  readonly descriptionText?: string;
  readonly activeFrom?: Date;
  readonly activeUntil?: Date;
  readonly routePublicIds?: readonly string[];
  readonly stopPublicIds?: readonly string[];
  readonly tripPublicIds?: readonly string[];
}

export interface GtfsRealtimeVehiclePositionsFeed {
  readonly scheduleVersion: string;
  readonly generatedAt: Date;
  readonly entities: readonly GtfsRealtimeVehiclePosition[];
}

export interface GtfsRealtimeVehiclePositionCandidate {
  readonly entityPublicId: string;
  readonly vehiclePublicId: string;
  readonly tripPublicId: string;
  readonly routePublicId: string;
  readonly startDate: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly bearing?: number;
  readonly speedMetresPerSecond?: number;
  readonly capturedAt: Date;
}

export type GtfsRealtimeHealthState = "disabled" | "healthy" | "delayed" | "stale";

export function classifyGtfsRealtimeHealth(enabled: boolean, lastObservedAt: Date | null, now: Date, delayedAfterMs = 45_000, staleAfterMs = 90_000): GtfsRealtimeHealthState {
  if (!enabled) return "disabled";
  if (!lastObservedAt || !Number.isFinite(lastObservedAt.getTime()) || !Number.isFinite(now.getTime())) return "stale";
  const age = now.getTime() - lastObservedAt.getTime();
  if (age < -30_000 || age > staleAfterMs) return "stale";
  return age > delayedAfterMs ? "delayed" : "healthy";
}

export function buildGtfsRealtimeVehiclePositions(input: {
  scheduleVersion: string;
  generatedAt: Date;
  published: GtfsPublishedReferences;
  candidates: readonly GtfsRealtimeVehiclePositionCandidate[];
}): { feed: GtfsRealtimeVehiclePositionsFeed; dropped: readonly { entityPublicId: string; reasons: readonly string[] }[] } {
  const dropped: { entityPublicId: string; reasons: readonly string[] }[] = [];
  const entities = input.candidates.flatMap((candidate) => {
    const position: GtfsRealtimeVehiclePosition = {
      entityPublicId: candidate.entityPublicId,
      vehiclePublicId: candidate.vehiclePublicId,
      trip: { tripPublicId: candidate.tripPublicId, routePublicId: candidate.routePublicId, startDate: candidate.startDate, scheduleRelationship: "scheduled" },
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      ...(candidate.bearing === undefined ? {} : { bearing: candidate.bearing }),
      ...(candidate.speedMetresPerSecond === undefined ? {} : { speedMetresPerSecond: candidate.speedMetresPerSecond }),
      capturedAt: candidate.capturedAt,
    };
    const reasons = validateGtfsRealtimeVehiclePosition(position, input.published, input.generatedAt);
    if (reasons.length) { dropped.push({ entityPublicId: candidate.entityPublicId, reasons }); return []; }
    return [position];
  }).sort((left, right) => left.entityPublicId.localeCompare(right.entityPublicId));
  return { feed: { scheduleVersion: input.scheduleVersion, generatedAt: input.generatedAt, entities }, dropped };
}

export function buildGtfsRealtimeTripUpdates(input: {
  scheduleVersion: string;
  generatedAt: Date;
  published: GtfsPublishedReferences;
  candidates: readonly GtfsRealtimeTripUpdate[];
}): { feed: GtfsRealtimeTripUpdatesFeed; dropped: readonly { entityPublicId: string; reasons: readonly string[] }[] } {
  const dropped: { entityPublicId: string; reasons: readonly string[] }[] = [];
  const entities = input.candidates.flatMap((candidate) => {
    const reasons = validateGtfsRealtimeTripUpdate(candidate, input.published, input.generatedAt);
    if (reasons.length) { dropped.push({ entityPublicId: candidate.entityPublicId, reasons }); return []; }
    return [candidate];
  }).sort((left, right) => left.entityPublicId.localeCompare(right.entityPublicId));
  return { feed: { scheduleVersion: input.scheduleVersion, generatedAt: input.generatedAt, entities }, dropped };
}

function validDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

function validStartDate(value: string): boolean {
  return /^\d{8}$/u.test(value);
}

function validateTripDescriptor(
  trip: GtfsRealtimeTripDescriptor,
  published: GtfsPublishedReferences,
): string[] {
  const errors: string[] = [];
  if (!validStartDate(trip.startDate)) errors.push("Realtime trip start date is invalid");
  if (trip.tripPublicId !== undefined && !published.tripIds.has(trip.tripPublicId)) {
    errors.push("Realtime trip is not present in the active Schedule feed");
  }
  if (trip.routePublicId !== undefined && !published.routeIds.has(trip.routePublicId)) {
    errors.push("Realtime route is not present in the active Schedule feed");
  }
  if (trip.scheduleRelationship === "unscheduled" && !trip.startTime) {
    errors.push("Unscheduled and headway trip instances need a start time");
  }
  if (trip.startTime !== undefined && !/^\d{2,3}:[0-5]\d:[0-5]\d$/u.test(trip.startTime)) {
    errors.push("Realtime trip start time is invalid");
  }
  if (!trip.tripPublicId && !trip.routePublicId) errors.push("Realtime trip needs a public trip or route reference");
  return errors;
}

function validateFreshTimestamp(capturedAt: Date, now: Date): string[] {
  if (!validDate(capturedAt) || !validDate(now)) return ["Realtime timestamp is invalid"];
  const ageMs = now.getTime() - capturedAt.getTime();
  if (ageMs < -30_000) return ["Realtime observation is too far in the future"];
  if (ageMs > 90_000) return ["Realtime observation is too old to publish"];
  return [];
}

export function validateGtfsRealtimeVehiclePosition(
  position: GtfsRealtimeVehiclePosition,
  published: GtfsPublishedReferences,
  now: Date,
): readonly string[] {
  const errors = [
    ...validateTripDescriptor(position.trip, published),
    ...validateFreshTimestamp(position.capturedAt, now),
  ];
  if (!isValidGtfsPublicId(position.entityPublicId) || !isValidGtfsPublicId(position.vehiclePublicId)) {
    errors.push("Realtime entity and vehicle public IDs are invalid");
  }
  if (!Number.isFinite(position.latitude) || position.latitude < -90 || position.latitude > 90
    || !Number.isFinite(position.longitude) || position.longitude < -180 || position.longitude > 180) {
    errors.push("Realtime vehicle coordinates are invalid");
  }
  if (position.bearing !== undefined
    && (!Number.isFinite(position.bearing) || position.bearing < 0 || position.bearing >= 360)) {
    errors.push("Realtime vehicle bearing is invalid");
  }
  if (position.speedMetresPerSecond !== undefined
    && (!Number.isFinite(position.speedMetresPerSecond) || position.speedMetresPerSecond < 0)) {
    errors.push("Realtime vehicle speed is invalid");
  }
  if (position.stopPublicId !== undefined && !published.stopIds.has(position.stopPublicId)) {
    errors.push("Realtime stop is not present in the active Schedule feed");
  }
  return errors;
}

export function validateGtfsRealtimeTripUpdate(
  update: GtfsRealtimeTripUpdate,
  published: GtfsPublishedReferences,
  now: Date,
): readonly string[] {
  const errors = [
    ...validateTripDescriptor(update.trip, published),
    ...validateFreshTimestamp(update.capturedAt, now),
  ];
  if (!isValidGtfsPublicId(update.entityPublicId)) errors.push("Realtime entity public ID is invalid");
  let previousSequence = -1;
  for (const stop of update.stopUpdates) {
    if (!published.stopIds.has(stop.stopPublicId)) errors.push("Trip update references a stop outside the active Schedule feed");
    if (!Number.isInteger(stop.stopSequence) || stop.stopSequence <= previousSequence) errors.push("Trip update stop sequences must increase");
    if (stop.arrivalAt && !validDate(stop.arrivalAt)) errors.push("Trip update arrival is invalid");
    if (stop.departureAt && !validDate(stop.departureAt)) errors.push("Trip update departure is invalid");
    if (stop.arrivalAt && stop.departureAt && stop.departureAt < stop.arrivalAt) errors.push("Trip update departure cannot precede arrival");
    previousSequence = stop.stopSequence;
  }
  return [...new Set(errors)];
}

export function validateGtfsRealtimeAlert(
  alert: GtfsRealtimeAlert,
  published: GtfsPublishedReferences,
): readonly string[] {
  const errors: string[] = [];
  if (!isValidGtfsPublicId(alert.entityPublicId) || !alert.headerText.trim()) errors.push("Realtime alert identity and header are required");
  if (alert.activeFrom && !validDate(alert.activeFrom) || alert.activeUntil && !validDate(alert.activeUntil)) errors.push("Realtime alert period is invalid");
  if (alert.activeFrom && alert.activeUntil && alert.activeUntil < alert.activeFrom) errors.push("Realtime alert period ends before it starts");
  if (alert.routePublicIds?.some((id) => !published.routeIds.has(id))) errors.push("Realtime alert references an unknown route");
  if (alert.stopPublicIds?.some((id) => !published.stopIds.has(id))) errors.push("Realtime alert references an unknown stop");
  if (alert.tripPublicIds?.some((id) => !published.tripIds.has(id))) errors.push("Realtime alert references an unknown trip");
  return errors;
}
