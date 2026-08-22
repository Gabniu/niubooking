// Ownership: approved-PostgreSQL proof for replay-safe, tenant-isolated fleet tracking.

import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Pool } from "pg";
import { assignFleetTripCrew, createDatabaseFleetTrackingAdmin, createFleetDeviceCredential, createFleetSessionCredential, enrollFleetDevice, handoverFleetTrackingSession, startFleetTrackingSession } from "./realtime-tracking.js";
import { runMigrations } from "./migrations.js";
import { withTenantTransaction } from "./pg-executor.js";

const connectionString = process.env.TEST_DATABASE_URL;
const migrationsDirectory = fileURLToPath(new URL("../migrations", import.meta.url));

test("tracking persists history, resists replay, and isolates current state", { skip: !connectionString }, async () => {
  const schema = `booking_tracking_${process.pid}_${Date.now()}`;
  const bootstrap = new Pool({ connectionString, max: 2 });
  await bootstrap.query(`CREATE SCHEMA "${schema}"`);
  await bootstrap.end();
  const pool = new Pool({ connectionString, max: 4, options: `-c search_path=${schema},public` });
  const tenantId = "tenant-tracking";
  const readerRole = `tracking_reader_${process.pid}_${Date.now()}`;
  assert.match(readerRole, /^[a-z][a-z0-9_]{0,62}$/u);
  const now = new Date();
  try {
    await runMigrations(pool, { directory: migrationsDirectory, schema });
    await pool.query("INSERT INTO local_users (id, identity_issuer, identity_subject) VALUES ('driver-1','test','driver-1'),('manager-1','test','manager-1')");
    await pool.query("INSERT INTO tenant_memberships (tenant_id, user_id, branch_ids, role, status) VALUES ($1,'driver-1','{branch-1}','driver','active'),($1,'manager-1','{branch-1}','manager','active')", [tenantId]);
    await pool.query("INSERT INTO booking_resources (id, tenant_id, name, resource_type) VALUES ('vehicle-1',$1,'Matatu 1','vehicle')", [tenantId]);
    await pool.query("INSERT INTO service_occurrences (id, tenant_id, service_id, label, starts_at, ends_at, status, capacity) VALUES ('occurrence-1',$1,'transport','Morning run',$2,$3,'open',14)", [tenantId, new Date(now.getTime() - 60_000), new Date(now.getTime() + 3_600_000)]);
    await pool.query("INSERT INTO transport_routes (id, tenant_id, version, name, mode, status) VALUES ('route-1',$1,1,'CBD route','matatu','published')", [tenantId]);
    await withTenantTransaction(pool, tenantId, async (executor) => { await executor.query("INSERT INTO tenant_branches (tenant_id, id, name, timezone) VALUES ($1,'branch-1','Nairobi','Africa/Nairobi')", [tenantId]); });
    await pool.query("INSERT INTO transport_trips (id, tenant_id, branch_id, route_id, route_version, occurrence_id, capacity_mode, capacity, boarding_starts_at, boarding_ends_at, vehicle_resource_id) VALUES ('trip-1',$1,'branch-1','route-1',1,'occurrence-1','open',14,$2,$3,'vehicle-1')", [tenantId, new Date(now.getTime() - 30_000), new Date(now.getTime() + 1_800_000)]);
    await withTenantTransaction(pool, tenantId, async (executor) => {
      await assignFleetTripCrew(executor, { id: "assignment-1", tenantId, branchId: "branch-1", tripId: "trip-1", userId: "driver-1", role: "driver", actorId: "manager-1" });
      await enrollFleetDevice(executor, { id: "device-1", tenantId, branchId: "branch-1", userId: "driver-1", platform: "android", label: "Driver phone", credentialSecret: "integration-driver-secret-is-long-enough", actorId: "manager-1" });
      await startFleetTrackingSession(executor, { id: "session-1", tenantId, tripId: "trip-1", deviceId: "device-1", driverUserId: "driver-1", expiresAt: new Date(now.getTime() + 3_600_000), traccarCredentialSecret: "session-secret-that-is-longer-than-32-characters", actorId: "manager-1" });
    });
    const trackingAdmin = createDatabaseFleetTrackingAdmin(pool);
    const credential = createFleetDeviceCredential(tenantId, "device-1", "integration-driver-secret-is-long-enough");

    const newest = { eventId: "event-2", sessionId: "session-1", sequence: 2, capturedAt: new Date(now.getTime() + 20_000), latitude: -1.2864, longitude: 36.8172, accuracyMetres: 8 };
    const delayed = { ...newest, eventId: "event-1", sequence: 1, capturedAt: new Date(now.getTime() + 10_000), latitude: -1.2865 };
    const receipts = [];
    for (const position of [newest, delayed, newest]) {
      const result = await trackingAdmin.ingestCredential(credential, position);
      assert.ok(result);
      receipts.push(result.receipt);
    }
    assert.deepEqual(receipts.map((receipt) => [receipt.decision, receipt.replayed]), [["advance_current", false], ["history_only", false], ["advance_current", true]]);
    const providerResult = await trackingAdmin.ingestTraccarCredential(createFleetSessionCredential(tenantId, "session-1", "session-secret-that-is-longer-than-32-characters"), { eventId: "event-3", capturedAt: new Date(now.getTime() + 30_000), latitude: -1.2863, longitude: 36.8173, accuracyMetres: 7 });
    assert.ok(providerResult && "receipt" in providerResult);
    assert.equal(providerResult.receipt.sessionId, "session-1");

    const evidence = await withTenantTransaction(pool, tenantId, async (executor) => ({
      current: await executor.query<{ event_id: string }>("SELECT event_id FROM fleet_current_positions WHERE tenant_id = $1 AND session_id = 'session-1'", [tenantId]),
      history: await executor.query<{ count: string }>("SELECT count(*)::text AS count FROM fleet_position_history WHERE tenant_id = $1 AND session_id = 'session-1'", [tenantId]),
      receipts: await executor.query<{ count: string }>("SELECT count(*)::text AS count FROM fleet_telemetry_receipts WHERE tenant_id = $1 AND session_id = 'session-1'", [tenantId]),
    }));
    assert.equal(evidence.current[0]?.event_id, "event-2");
    assert.equal(evidence.history[0]?.count, "2");
    assert.equal(evidence.receipts[0]?.count, "2");

    await pool.query(`CREATE ROLE "${readerRole}" NOLOGIN NOSUPERUSER NOBYPASSRLS`);
    await pool.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${readerRole}"`);
    await pool.query(`GRANT SELECT ON fleet_current_positions TO "${readerRole}"`);
    const reader = await pool.connect();
    try {
      await reader.query("BEGIN");
      await reader.query(`SET LOCAL ROLE "${readerRole}"`);
      await reader.query("SELECT set_config('booking.tenant_id', 'other-tenant', true)");
      const hidden = await reader.query("SELECT event_id FROM fleet_current_positions");
      assert.equal(hidden.rows.length, 0);
      await reader.query("ROLLBACK");
    } finally { reader.release(); }

    await assert.rejects(() => withTenantTransaction(pool, tenantId, (executor) => startFleetTrackingSession(executor, { id: "session-conflict", tenantId, tripId: "trip-1", deviceId: "device-1", driverUserId: "driver-1", expiresAt: new Date(now.getTime() + 3_600_000), traccarCredentialSecret: "conflict-secret-that-is-longer-than-32-characters" })), /fleet_active_session/iu);
    await withTenantTransaction(pool, tenantId, async (executor) => {
      const replacement = await handoverFleetTrackingSession(executor, { previousSessionId: "session-1", id: "session-2", tenantId, tripId: "trip-1", deviceId: "device-1", driverUserId: "driver-1", expiresAt: new Date(now.getTime() + 3_600_000), traccarCredentialSecret: "replacement-secret-that-is-longer-than-32-characters", actorId: "manager-1" });
      assert.equal(replacement.status, "active");
    });
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.query(`DROP ROLE IF EXISTS "${readerRole}"`);
    await pool.end();
  }
});
