// Ownership: ordered, checksum-protected PostgreSQL schema migration runner.

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolClient } from "pg";

export interface MigrationRunOptions {
  readonly directory: string;
  readonly schema?: string;
}

export interface MigrationRunResult {
  readonly applied: readonly string[];
  readonly alreadyApplied: number;
}

interface AppliedMigrationRow {
  readonly name: string;
  readonly checksum: string;
}

const migrationPattern = /^\d{3}_[a-z0-9_]+\.sql$/u;
const schemaPattern = /^[a-z][a-z0-9_]{0,62}$/u;

function checksum(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function quotedSchema(schema: string): string {
  if (!schemaPattern.test(schema)) throw new Error(`Invalid migration schema: ${schema}`);
  return `"${schema}"`;
}

async function loadMigrations(directory: string) {
  const names = (await readdir(directory)).filter((name) => migrationPattern.test(name)).sort();
  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(path.join(directory, name), "utf8");
      return { name, sql, checksum: checksum(sql) };
    }),
  );
}

async function prepareLedger(client: PoolClient, schema: string): Promise<void> {
  await client.query(`SET LOCAL search_path TO ${quotedSchema(schema)}, public`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS booking_schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function runMigrations(pool: Pool, options: MigrationRunOptions): Promise<MigrationRunResult> {
  const schema = options.schema ?? "public";
  const migrations = await loadMigrations(options.directory);
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('booking-schema-migrations'))");
    await prepareLedger(client, schema);
    const result = await client.query<AppliedMigrationRow>(
      "SELECT name, checksum FROM booking_schema_migrations ORDER BY name",
    );
    const existing = new Map(result.rows.map((row) => [row.name, row.checksum]));
    for (const migration of migrations) {
      const previousChecksum = existing.get(migration.name);
      if (previousChecksum && previousChecksum !== migration.checksum) {
        throw new Error(`Applied migration changed: ${migration.name}`);
      }
      if (previousChecksum) continue;
      await client.query(migration.sql);
      await client.query("INSERT INTO booking_schema_migrations (name, checksum) VALUES ($1, $2)", [
        migration.name,
        migration.checksum,
      ]);
      applied.push(migration.name);
    }
    await client.query("COMMIT");
    return { applied, alreadyApplied: existing.size };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
