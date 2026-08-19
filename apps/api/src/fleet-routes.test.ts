import assert from "node:assert/strict";
import test from "node:test";
import type { FleetTrackingAdmin } from "./fleet-routes.js";
import { createApiServer } from "./server.js";

const identity = { issuer: "test", subject: "owner-1" };
const context = (role: string, userId = `${role}-1`, branchIds = ["branch-1"]) => ({ identity: { ...identity, subject: userId }, mappedUserId: userId, membership: { userId, tenantId: "tenant-1", branchIds, role, status: "active" as const }, requestedTenantId: "tenant-1" });
const device = { id: "device-1", tenantId: "tenant-1", branchId: "branch-1", userId: "driver-1", vehicleResourceId: null, platform: "android" as const, label: "Driver phone", status: "enrolled" as const, enrolledAt: new Date("2030-01-01T08:00:00Z"), revokedAt: null };
const session = { id: "session-1", tenantId: "tenant-1", branchId: "branch-1", tripId: "trip-1", deviceId: "device-1", driverUserId: "driver-1", vehicleResourceId: "vehicle-1", status: "active" as const, startedAt: new Date("2030-01-01T08:00:00Z"), expiresAt: new Date("2030-01-01T12:00:00Z"), endedAt: null };

function fleet(overrides: Partial<FleetTrackingAdmin> = {}): FleetTrackingAdmin {
  return {
    enroll: async () => device,
    assign: async (input) => ({ id: input.id, tenantId: input.tenantId, branchId: input.branchId, tripId: input.tripId, userId: input.userId, role: input.role, status: "active", assignedAt: new Date(), endedAt: null }),
    start: async () => session,
    handover: async () => session,
    end: async () => ({ ...session, status: "ended", endedAt: new Date("2030-01-01T09:00:00Z") }),
    listCurrent: async () => [],
    readTripBranch: async () => "branch-1",
    readSessionScope: async () => ({ branchId: "branch-1", driverUserId: "driver-1" }),
    ingestCredential: async (_credential, position) => ({ receipt: { tenantId: "tenant-1", eventId: position.eventId, sessionId: position.sessionId, deviceId: "device-1", decision: "advance_current", reasons: [], replayed: false }, receivedAt: new Date("2030-01-01T09:00:01Z") }),
    ...overrides,
  };
}

test("owner enrolls a driver device and receives its credential only at creation", async () => {
  let secret = "";
  const app = createApiServer({ resolve: () => context("owner"), fleetTracking: fleet({ enroll: async (input) => { secret = input.credentialSecret; return device; } }) });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/fleet/devices", payload: { branchId: "branch-1", userId: "driver-1", platform: "android", label: "Driver phone" } });
  assert.equal(response.statusCode, 201);
  assert.match(response.json().data.credential, /^niu_fleet_v1\./u);
  assert.equal(secret.length >= 32, true);
  assert.equal("credentialSecret" in response.json().data, false);
});

test("manager cannot enroll devices or assign a trip outside their branch", async () => {
  const app = createApiServer({ resolve: () => context("manager"), fleetTracking: fleet() });
  assert.equal((await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/fleet/devices", payload: { branchId: "branch-1", userId: "driver-1", platform: "android", label: "Phone" } })).statusCode, 403);
  assert.equal((await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/fleet/assignments", payload: { branchId: "branch-2", tripId: "trip-1", userId: "driver-1", role: "driver" } })).statusCode, 403);
});

test("assigned driver starts and ends their own tracking session", async () => {
  let startedBy = ""; let endedBy = "";
  const app = createApiServer({ resolve: () => context("driver"), fleetTracking: fleet({ start: async (input) => { startedBy = input.driverUserId; return session; }, end: async (input) => { endedBy = input.driverUserId ?? ""; return { ...session, status: "ended", endedAt: new Date("2030-01-01T09:00:00Z") }; } }) });
  const started = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/fleet/tracking-sessions", payload: { tripId: "trip-1", deviceId: "device-1", durationMinutes: 60 } });
  assert.equal(started.statusCode, 201); assert.equal(startedBy, "driver-1");
  const ended = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/fleet/tracking-sessions/session-1/end", payload: { reason: "trip complete" } });
  assert.equal(ended.statusCode, 200); assert.equal(endedBy, "driver-1");
});

test("branch manager can perform an explicit tracking handover", async () => {
  let handedTo = "";
  const app = createApiServer({ resolve: () => context("manager"), fleetTracking: fleet({ handover: async (input) => { handedTo = input.driverUserId; return session; } }) });
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/fleet/tracking-sessions/session-1/handover", payload: { tripId: "trip-1", deviceId: "device-2", driverUserId: "driver-2", durationMinutes: 30 } });
  assert.equal(response.statusCode, 201);
  assert.equal(handedTo, "driver-2");
});

test("branch manager receives only branch-filtered privacy-safe fleet projections", async () => {
  let branches: readonly string[] | undefined; let assignedUser: string | undefined;
  const app = createApiServer({ resolve: () => context("manager"), fleetTracking: fleet({ listCurrent: async (_tenant, branchIds, assigned) => { branches = branchIds; assignedUser = assigned; return [{ tripId: "trip-1", branchId: "branch-1", vehicleLabel: "Matatu 1", routeLabel: "CBD", capturedAt: new Date(), latitude: -1.28, longitude: 36.81, accuracyMetres: 8, headingDegrees: 90 }]; } }) });
  const response = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/fleet/current" });
  assert.equal(response.statusCode, 200); assert.deepEqual(branches, ["branch-1"]); assert.equal(assignedUser, undefined);
  assert.equal(response.json().data[0].vehicleLabel, "Matatu 1");
  assert.equal("deviceId" in response.json().data[0], false);
  assert.equal("sessionId" in response.json().data[0], false);
});

test("driver current projection is assignment-filtered", async () => {
  let assignedUser = "";
  const app = createApiServer({ resolve: () => context("driver"), fleetTracking: fleet({ listCurrent: async (_tenant, _branches, assigned) => { assignedUser = assigned ?? ""; return []; } }) });
  assert.equal((await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/fleet/current" })).statusCode, 200);
  assert.equal(assignedUser, "driver-1");
});

test("telemetry requires a device credential and never accepts tenant or device scope from the body", async () => {
  let seenCredential = ""; let seenDevice = false;
  const app = createApiServer({ resolve: () => context("owner"), fleetTracking: fleet({ ingestCredential: async (credential, position) => { seenCredential = credential; seenDevice = "deviceId" in position; return { receipt: { tenantId: "tenant-1", eventId: position.eventId, sessionId: position.sessionId, deviceId: "device-1", decision: "advance_current", reasons: [], replayed: false }, receivedAt: new Date("2030-01-01T09:00:01Z") }; } }) });
  const payload = { sessionId: "session-1", eventId: "event-1", sequence: 1, capturedAt: "2030-01-01T09:00:00Z", latitude: -1.28, longitude: 36.81, accuracyMetres: 8 };
  assert.equal((await app.inject({ method: "POST", url: "/v1/fleet/telemetry", payload })).statusCode, 401);
  const response = await app.inject({ method: "POST", url: "/v1/fleet/telemetry", headers: { authorization: "Bearer credential-1" }, payload });
  assert.equal(response.statusCode, 202); assert.equal(seenCredential, "credential-1"); assert.equal(seenDevice, false);
});
