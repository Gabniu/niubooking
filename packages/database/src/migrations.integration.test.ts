// Ownership: real PostgreSQL proof for the complete additive migration chain.

import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Pool } from "pg";
import { listMigrationNames, runMigrations } from "./migrations.js";

const connectionString = process.env.TEST_DATABASE_URL;
const migrationsDirectory = fileURLToPath(new URL("../migrations", import.meta.url));

test("all migrations apply to PostgreSQL and rerun idempotently", { skip: !connectionString }, async () => {
  const pool = new Pool({ connectionString, max: 2 });
  const schema = `booking_test_${process.pid}_${Date.now()}`;
  assert.match(schema, /^[a-z][a-z0-9_]{0,62}$/u);
  try {
    const migrationCount = (await listMigrationNames(migrationsDirectory)).length;
    await pool.query(`CREATE SCHEMA "${schema}"`);
    const first = await runMigrations(pool, { directory: migrationsDirectory, schema });
    const second = await runMigrations(pool, { directory: migrationsDirectory, schema });
    assert.equal(first.applied.length, migrationCount);
    assert.equal(second.applied.length, 0);
    assert.equal(second.alreadyApplied, migrationCount);

    const tables = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = $1",
      [schema],
    );
    const tableNames = new Set(tables.rows.map((row) => row.table_name));
    for (const expected of ["bookings", "booking_resources", "customers", "feedback_responses", "service_occurrences", "service_reservations", "audit_events", "booking_sessions"]) {
      assert.equal(tableNames.has(expected), true, `missing ${expected}`);
    }

    const policyColumns = await pool.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'communication_settings'",
      [schema],
    );
    const columnNames = new Set(policyColumns.rows.map((row) => row.column_name));
    assert.equal(columnNames.has("minimum_change_notice_minutes"), true);
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
  }
});
