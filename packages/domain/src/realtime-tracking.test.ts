import assert from "node:assert/strict";
import test from "node:test";
import { validateFleetDeviceEnrollment, validateFleetTrackingSession, validateFleetTripAssignment } from "./realtime-tracking.js";

test("accepts a driver-owned mobile device and rejects unscoped enrollment", () => {
  const valid = { id: "device-1", tenantId: "tenant-1", branchId: "branch-1", userId: "driver-1", platform: "android" as const, label: "Driver phone", credentialHash: "a".repeat(64) };
  assert.deepEqual(validateFleetDeviceEnrollment(valid), []);
  assert.match(validateFleetDeviceEnrollment({ ...valid, userId: null, credentialHash: "raw-secret" }).join("; "), /belong|hash/iu);
});

test("validates driver assignments and bounded session lifetime", () => {
  assert.deepEqual(validateFleetTripAssignment({ id: "assignment-1", tenantId: "tenant-1", branchId: "branch-1", tripId: "trip-1", userId: "driver-1", role: "driver" }), []);
  const now = new Date("2030-01-01T08:00:00Z");
  assert.deepEqual(validateFleetTrackingSession({ id: "session-1", tenantId: "tenant-1", tripId: "trip-1", deviceId: "device-1", driverUserId: "driver-1", now, expiresAt: new Date("2030-01-01T12:00:00Z") }), []);
  assert.match(validateFleetTrackingSession({ id: "session-1", tenantId: "tenant-1", tripId: "trip-1", deviceId: "device-1", driverUserId: "driver-1", now, expiresAt: new Date("2030-01-03T12:00:00Z") }).join("; "), /24 hours/iu);
});
