// Ownership: framework-free telemetry validation, ordering, and freshness policy.

export type PositionFreshness = "live" | "delayed" | "signal_weak" | "offline";
export type TelemetryDecision = "advance_current" | "history_only" | "reject";

export interface VehiclePosition {
  readonly eventId: string;
  readonly sessionId: string;
  readonly deviceId: string;
  readonly sequence: number;
  readonly capturedAt: Date;
  readonly receivedAt: Date;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMetres: number;
  readonly speedMetresPerSecond?: number;
  readonly headingDegrees?: number;
  readonly batteryPercent?: number;
  readonly provider?: string;
  readonly appVersion?: string;
}

export interface TelemetryPolicy {
  readonly maximumFutureSkewMs: number;
  readonly maximumHistoryAgeMs: number;
  readonly maximumAccuracyMetres: number;
  readonly maximumPlausibleSpeedMetresPerSecond: number;
}

export interface TelemetryEvaluation {
  readonly decision: TelemetryDecision;
  readonly reasons: readonly string[];
}

export const defaultTelemetryPolicy: TelemetryPolicy = {
  maximumFutureSkewMs: 120_000,
  maximumHistoryAgeMs: 24 * 60 * 60 * 1_000,
  maximumAccuracyMetres: 250,
  maximumPlausibleSpeedMetresPerSecond: 70,
};

function validIdentifier(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);
}

function validDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

function radians(value: number): number {
  return value * Math.PI / 180;
}

function distanceMetres(left: VehiclePosition, right: VehiclePosition): number {
  const earthRadius = 6_371_000;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function validateVehiclePosition(
  position: VehiclePosition,
  policy: TelemetryPolicy = defaultTelemetryPolicy,
): readonly string[] {
  const errors: string[] = [];
  if (![position.eventId, position.sessionId, position.deviceId].every(validIdentifier)) {
    errors.push("Position identity is invalid");
  }
  if (!Number.isSafeInteger(position.sequence) || position.sequence < 0) {
    errors.push("Position sequence must be a non-negative safe integer");
  }
  if (!validDate(position.capturedAt) || !validDate(position.receivedAt)) {
    errors.push("Position timestamps are invalid");
  } else {
    if (position.capturedAt.getTime() - position.receivedAt.getTime() > policy.maximumFutureSkewMs) {
      errors.push("Position capture time is too far in the future");
    }
    if (position.receivedAt.getTime() - position.capturedAt.getTime() > policy.maximumHistoryAgeMs) {
      errors.push("Position is older than the accepted history window");
    }
  }
  if (!Number.isFinite(position.latitude) || position.latitude < -90 || position.latitude > 90
    || !Number.isFinite(position.longitude) || position.longitude < -180 || position.longitude > 180) {
    errors.push("Position coordinates are invalid");
  }
  if (!Number.isFinite(position.accuracyMetres) || position.accuracyMetres < 0
    || position.accuracyMetres > policy.maximumAccuracyMetres) {
    errors.push("Position accuracy is outside the accepted range");
  }
  if (position.speedMetresPerSecond !== undefined
    && (!Number.isFinite(position.speedMetresPerSecond) || position.speedMetresPerSecond < 0
      || position.speedMetresPerSecond > policy.maximumPlausibleSpeedMetresPerSecond)) {
    errors.push("Position speed is outside the accepted range");
  }
  if (position.headingDegrees !== undefined
    && (!Number.isFinite(position.headingDegrees) || position.headingDegrees < 0 || position.headingDegrees >= 360)) {
    errors.push("Position heading is outside the accepted range");
  }
  if (position.batteryPercent !== undefined
    && (!Number.isFinite(position.batteryPercent) || position.batteryPercent < 0 || position.batteryPercent > 100)) {
    errors.push("Position battery level is outside the accepted range");
  }
  return errors;
}

function comparePositionOrder(left: VehiclePosition, right: VehiclePosition): number {
  const captured = left.capturedAt.getTime() - right.capturedAt.getTime();
  return captured === 0 ? left.sequence - right.sequence : captured;
}

export function evaluateVehiclePosition(
  candidate: VehiclePosition,
  current: VehiclePosition | null,
  policy: TelemetryPolicy = defaultTelemetryPolicy,
): TelemetryEvaluation {
  const errors = validateVehiclePosition(candidate, policy);
  if (errors.length > 0) return { decision: "reject", reasons: errors };
  if (!current) return { decision: "advance_current", reasons: [] };
  if (candidate.sessionId !== current.sessionId || candidate.deviceId !== current.deviceId) {
    return { decision: "reject", reasons: ["Position does not match the active device session"] };
  }
  const order = comparePositionOrder(candidate, current);
  if (order === 0 || candidate.eventId === current.eventId) {
    return { decision: "reject", reasons: ["Position is a duplicate"] };
  }
  if (order < 0) {
    return { decision: "history_only", reasons: ["Position arrived after a newer measurement"] };
  }
  const elapsedSeconds = (candidate.capturedAt.getTime() - current.capturedAt.getTime()) / 1_000;
  if (elapsedSeconds > 0) {
    const computedSpeed = distanceMetres(current, candidate) / elapsedSeconds;
    if (computedSpeed > policy.maximumPlausibleSpeedMetresPerSecond) {
      return { decision: "reject", reasons: ["Position jump exceeds the plausible speed limit"] };
    }
  }
  return { decision: "advance_current", reasons: [] };
}

export function classifyPositionFreshness(
  capturedAt: Date,
  now: Date,
  sessionActive = true,
): PositionFreshness {
  if (!sessionActive || !validDate(capturedAt) || !validDate(now)) return "offline";
  const ageMs = Math.max(0, now.getTime() - capturedAt.getTime());
  if (ageMs <= 15_000) return "live";
  if (ageMs <= 45_000) return "delayed";
  if (ageMs <= 90_000) return "signal_weak";
  return "offline";
}
