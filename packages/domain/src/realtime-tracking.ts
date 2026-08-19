// Ownership: branch-scoped device, assignment, and tracking-session invariants.

import type { TelemetryDecision, VehiclePosition } from "./realtime-telemetry.js";

export type FleetDevicePlatform = "android" | "ios" | "hardware";
export type FleetDeviceStatus = "enrolled" | "revoked";
export type FleetAssignmentRole = "driver" | "conductor";
export type FleetTrackingSessionStatus = "active" | "ended" | "revoked";

export interface TenantBranch {
  readonly tenantId: string;
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly status: "active" | "archived";
}

export interface FleetDevice {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly userId: string | null;
  readonly vehicleResourceId: string | null;
  readonly platform: FleetDevicePlatform;
  readonly label: string;
  readonly status: FleetDeviceStatus;
  readonly enrolledAt: Date;
  readonly revokedAt: Date | null;
}

export interface FleetTripAssignment {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly tripId: string;
  readonly userId: string;
  readonly role: FleetAssignmentRole;
  readonly status: "active" | "ended";
  readonly assignedAt: Date;
  readonly endedAt: Date | null;
}

export interface FleetTrackingSession {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly tripId: string;
  readonly deviceId: string;
  readonly driverUserId: string;
  readonly vehicleResourceId: string;
  readonly status: FleetTrackingSessionStatus;
  readonly startedAt: Date;
  readonly expiresAt: Date;
  readonly endedAt: Date | null;
}

export interface ScopedVehiclePosition extends VehiclePosition {
  readonly tenantId: string;
  readonly branchId: string;
  readonly tripId: string;
  readonly vehicleResourceId: string;
}

export interface TelemetryReceipt {
  readonly tenantId: string;
  readonly eventId: string;
  readonly sessionId: string;
  readonly deviceId: string;
  readonly decision: TelemetryDecision;
  readonly reasons: readonly string[];
  readonly replayed: boolean;
}

function validIdentifier(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);
}

export function validateFleetDeviceEnrollment(input: {
  id: string;
  tenantId: string;
  branchId: string;
  userId?: string | null;
  vehicleResourceId?: string | null;
  platform: FleetDevicePlatform;
  label: string;
  credentialHash: string;
}): readonly string[] {
  const errors: string[] = [];
  if (![input.id, input.tenantId, input.branchId].every(validIdentifier)) errors.push("Device scope is invalid");
  if (!input.userId && !input.vehicleResourceId) errors.push("Device must belong to a driver or vehicle");
  if (input.userId && !validIdentifier(input.userId)) errors.push("Device driver is invalid");
  if (input.vehicleResourceId && !validIdentifier(input.vehicleResourceId)) errors.push("Device vehicle is invalid");
  if (!["android", "ios", "hardware"].includes(input.platform)) errors.push("Device platform is invalid");
  if (!input.label.trim() || input.label.trim().length > 120) errors.push("Device label must be between 1 and 120 characters");
  if (!/^[0-9a-f]{64}$/u.test(input.credentialHash)) errors.push("Device credential hash is invalid");
  return errors;
}

export function validateFleetTripAssignment(input: {
  id: string;
  tenantId: string;
  branchId: string;
  tripId: string;
  userId: string;
  role: FleetAssignmentRole;
}): readonly string[] {
  const errors: string[] = [];
  if (![input.id, input.tenantId, input.branchId, input.tripId, input.userId].every(validIdentifier)) errors.push("Trip assignment identity is invalid");
  if (input.role !== "driver" && input.role !== "conductor") errors.push("Trip assignment role is invalid");
  return errors;
}

export function validateFleetTrackingSession(input: {
  id: string;
  tenantId: string;
  tripId: string;
  deviceId: string;
  driverUserId: string;
  expiresAt: Date;
  now: Date;
}): readonly string[] {
  const errors: string[] = [];
  if (![input.id, input.tenantId, input.tripId, input.deviceId, input.driverUserId].every(validIdentifier)) errors.push("Tracking session identity is invalid");
  if (!Number.isFinite(input.expiresAt.getTime()) || input.expiresAt <= input.now) errors.push("Tracking session expiry must be in the future");
  if (input.expiresAt.getTime() - input.now.getTime() > 24 * 60 * 60 * 1_000) errors.push("Tracking session cannot exceed 24 hours");
  return errors;
}
