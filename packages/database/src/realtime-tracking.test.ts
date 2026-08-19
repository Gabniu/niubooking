import assert from "node:assert/strict";
import test from "node:test";
import { enrollFleetDevice, handoverFleetTrackingSession, ingestFleetPosition, startFleetTrackingSession } from "./realtime-tracking.js";

const sessionRow = { id: "session-1", tenant_id: "tenant-1", branch_id: "branch-1", trip_id: "trip-1", device_id: "device-1", driver_user_id: "driver-1", vehicle_resource_id: "vehicle-1", status: "active" as const, started_at: new Date("2030-01-01T08:00:00Z"), expires_at: new Date("2030-01-01T12:00:00Z"), ended_at: null };
const position = { eventId: "event-2", sessionId: "session-1", deviceId: "device-1", sequence: 2, capturedAt: new Date("2030-01-01T09:00:10Z"), receivedAt: new Date("2030-01-01T09:00:11Z"), latitude: -1.2864, longitude: 36.8172, accuracyMetres: 8 };

test("enrolls a device with a hash and never sends the raw credential to SQL", async () => {
  const parameters: (readonly unknown[])[] = [];
  const executor = { query: async <T>(sql: string, values: readonly unknown[]) => { parameters.push(values); if (sql.startsWith("INSERT INTO fleet_devices")) return [{ id: "device-1", tenant_id: "tenant-1", branch_id: "branch-1", user_id: "driver-1", vehicle_resource_id: null, platform: "android", label: "Driver phone", status: "enrolled", enrolled_at: new Date(), revoked_at: null }] as T[]; return [{ id: "audit-1", tenant_id: "tenant-1", actor_type: "user", actor_id: "manager-1", action: "fleet.device_enrolled", entity_type: "fleet_device", entity_id: "device-1", metadata: {}, occurred_at: new Date() }] as T[]; } };
  await enrollFleetDevice(executor, { id: "device-1", tenantId: "tenant-1", branchId: "branch-1", userId: "driver-1", platform: "android", label: "Driver phone", credentialSecret: "driver-secret-that-is-longer-than-32-characters", actorId: "manager-1" });
  assert.equal(parameters.flat().includes("driver-secret-that-is-longer-than-32-characters"), false);
  assert.match(String(parameters[0]?.[5]), /^[0-9a-f]{64}$/u);
});

test("starts tracking only when server-side driver, device, branch, trip, and vehicle scope matches", async () => {
  const statements: string[] = [];
  const executor = { query: async <T>(sql: string) => { statements.push(sql); if (sql.startsWith("SELECT trip.branch_id")) return [{ branch_id: "branch-1", vehicle_resource_id: "vehicle-1" }] as T[]; if (sql.startsWith("INSERT INTO fleet_tracking_sessions")) return [sessionRow] as T[]; return [{ id: "audit-1", tenant_id: "tenant-1", actor_type: "user", actor_id: "manager-1", action: "fleet.tracking_started", entity_type: "fleet_tracking_session", entity_id: "session-1", metadata: {}, occurred_at: new Date() }] as T[]; } };
  const session = await startFleetTrackingSession(executor, { id: "session-1", tenantId: "tenant-1", tripId: "trip-1", deviceId: "device-1", driverUserId: "driver-1", expiresAt: new Date(Date.now() + 60_000), actorId: "manager-1" });
  assert.equal(session.branchId, "branch-1");
  assert.ok(statements.some((sql) => sql.includes("assignment.status = 'active'")));
  await assert.rejects(() => startFleetTrackingSession({ query: async <T>() => [] as T[] }, { id: "session-2", tenantId: "tenant-1", tripId: "trip-1", deviceId: "wrong-device", driverUserId: "driver-1", expiresAt: new Date(Date.now() + 60_000) }), /must all match/iu);
});

test("stores delayed telemetry as history without rewinding current position", async () => {
  const statements: string[] = [];
  const current = { event_id: "event-2", session_id: "session-1", device_id: "device-1", sequence: 2, captured_at: position.capturedAt, received_at: position.receivedAt, latitude: position.latitude, longitude: position.longitude, accuracy_metres: 8, speed_metres_per_second: null, heading_degrees: null, battery_percent: null };
  const delayed = { ...position, eventId: "event-1", sequence: 1, capturedAt: new Date("2030-01-01T09:00:00Z"), receivedAt: new Date("2030-01-01T09:00:12Z") };
  const executor = { query: async <T>(sql: string) => { statements.push(sql); if (sql.startsWith("SELECT tenant_id")) return [] as T[]; if (sql.includes("FROM fleet_tracking_sessions")) return [sessionRow] as T[]; if (sql.includes("FROM fleet_current_positions")) return [current] as T[]; if (sql.startsWith("INSERT INTO fleet_telemetry_receipts")) return [{ tenant_id: "tenant-1", event_id: "event-1", session_id: "session-1", device_id: "device-1", decision: "history_only", reason_code: "Position arrived after a newer measurement" }] as T[]; return [] as T[]; } };
  const receipt = await ingestFleetPosition(executor, { tenantId: "tenant-1", position: delayed });
  assert.equal(receipt.decision, "history_only");
  assert.ok(statements.some((sql) => sql.startsWith("INSERT INTO fleet_position_history")));
  assert.equal(statements.some((sql) => sql.startsWith("INSERT INTO fleet_current_positions")), false);
});

test("returns the original receipt for a replay without writing again", async () => {
  const statements: string[] = [];
  const executor = { query: async <T>(sql: string) => { statements.push(sql); return [{ tenant_id: "tenant-1", event_id: "event-2", session_id: "session-1", device_id: "device-1", decision: "advance_current", reason_code: null }] as T[]; } };
  const receipt = await ingestFleetPosition(executor, { tenantId: "tenant-1", position });
  assert.equal(receipt.replayed, true);
  assert.equal(statements.length, 1);
});

test("hands over only the still-active session before starting its replacement", async () => {
  const statements: string[] = [];
  const replacement = { ...sessionRow, id: "session-2", device_id: "device-2" };
  const executor = { query: async <T>(sql: string) => { statements.push(sql); if (sql.startsWith("UPDATE fleet_tracking_sessions")) return [{ id: "session-1" }] as T[]; if (sql.startsWith("SELECT trip.branch_id")) return [{ branch_id: "branch-1", vehicle_resource_id: "vehicle-1" }] as T[]; if (sql.startsWith("INSERT INTO fleet_tracking_sessions")) return [replacement] as T[]; return [{ id: "audit-1", tenant_id: "tenant-1", actor_type: "user", actor_id: "manager-1", action: "fleet.tracking_handover", entity_type: "fleet_tracking_session", entity_id: "session-2", metadata: {}, occurred_at: new Date() }] as T[]; } };
  const result = await handoverFleetTrackingSession(executor, { previousSessionId: "session-1", id: "session-2", tenantId: "tenant-1", tripId: "trip-1", deviceId: "device-2", driverUserId: "driver-1", expiresAt: new Date(Date.now() + 60_000), actorId: "manager-1" });
  assert.equal(result.id, "session-2");
  assert.ok(statements[0]?.startsWith("UPDATE fleet_tracking_sessions"));
});
