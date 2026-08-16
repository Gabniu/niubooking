// Ownership: approved-PostgreSQL proof for atomic occurrence capacity admission.

import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Pool } from "pg";
import { createDatabaseOccurrenceAdmin } from "./occurrences.js";
import { runMigrations } from "./migrations.js";

const connectionString = process.env.TEST_DATABASE_URL;
const migrationsDirectory = fileURLToPath(new URL("../migrations", import.meta.url));

test("competing reservations cannot oversell one occurrence", { skip: !connectionString }, async () => {
  const schema = `booking_concurrency_${process.pid}_${Date.now()}`;
  const bootstrap = new Pool({ connectionString, max: 2 });
  await bootstrap.query(`CREATE SCHEMA "${schema}"`);
  await bootstrap.end();
  const pool = new Pool({ connectionString, max: 10, options: `-c search_path=${schema},public` });
  try {
    await runMigrations(pool, { directory: migrationsDirectory, schema });
    await pool.query("INSERT INTO service_occurrences (id, tenant_id, service_id, label, starts_at, ends_at, status, capacity) VALUES ($1,$2,$3,$4,$5,$6,'open',$7)", ["occ-concurrency", "tenant-concurrency", "service-1", "Concurrent class", new Date("2030-01-01T09:00:00Z"), new Date("2030-01-01T10:00:00Z"), 2]);
    const admin = createDatabaseOccurrenceAdmin(pool);
    const attempts = await Promise.all(Array.from({ length: 5 }, (_, index) => admin.reserve({ id: `reservation-${index}`, tenantId: "tenant-concurrency", occurrenceId: "occ-concurrency", customerId: `customer-${index}`, quantity: 1, createIdempotencyKey: `concurrency-request-${index}` }).then(() => true).catch(() => false)));
    assert.equal(attempts.filter(Boolean).length, 2);
    const occurrence = await pool.query<{ reserved_quantity: number }>("SELECT reserved_quantity FROM service_occurrences WHERE tenant_id = $1 AND id = $2", ["tenant-concurrency", "occ-concurrency"]);
    const reservations = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM service_reservations WHERE tenant_id = $1 AND occurrence_id = $2", ["tenant-concurrency", "occ-concurrency"]);
    assert.equal(occurrence.rows[0]?.reserved_quantity, 2);
    assert.equal(reservations.rows[0]?.count, "2");
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
  }
});

test("concurrent cancellation releases occurrence capacity exactly once per reservation", { skip: !connectionString }, async () => {
  const schema = `booking_lifecycle_${process.pid}_${Date.now()}`;
  const bootstrap = new Pool({ connectionString, max: 2 });
  await bootstrap.query(`CREATE SCHEMA "${schema}"`);
  await bootstrap.end();
  const pool = new Pool({ connectionString, max: 10, options: `-c search_path=${schema},public` });
  try {
    await runMigrations(pool, { directory: migrationsDirectory, schema });
    await pool.query("INSERT INTO service_occurrences (id, tenant_id, service_id, label, starts_at, ends_at, status, capacity) VALUES ($1,$2,$3,$4,$5,$6,'open',$7)", ["occ-lifecycle", "tenant-lifecycle", "service-1", "Lifecycle class", new Date("2030-01-01T09:00:00Z"), new Date("2030-01-01T10:00:00Z"), 2]);
    const admin = createDatabaseOccurrenceAdmin(pool);
    await Promise.all(["reservation-a", "reservation-b"].map((id) => admin.reserve({ id, tenantId: "tenant-lifecycle", occurrenceId: "occ-lifecycle", customerId: `customer-${id}`, quantity: 1, createIdempotencyKey: `lifecycle-${id}` })));
    await Promise.all(["reservation-a", "reservation-b"].map((reservationId) => admin.setReservationStatus({ tenantId: "tenant-lifecycle", occurrenceId: "occ-lifecycle", reservationId, status: "cancelled", actorId: "staff-1" })));
    const occurrence = await pool.query<{ reserved_quantity: number }>("SELECT reserved_quantity FROM service_occurrences WHERE tenant_id = $1 AND id = $2", ["tenant-lifecycle", "occ-lifecycle"]);
    const audits = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM audit_events WHERE tenant_id = $1 AND entity_type = 'reservation'", ["tenant-lifecycle"]);
    assert.equal(occurrence.rows[0]?.reserved_quantity, 0);
    assert.equal(audits.rows[0]?.count, "2");
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
  }
});
