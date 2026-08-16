import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { runMigrations } from "../packages/database/dist/migrations.js";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL is required to run migrations");

const schema = process.env.BOOKING_DB_SCHEMA?.trim() || "public";
const directory = fileURLToPath(new URL("../packages/database/migrations", import.meta.url));
const pool = new Pool({ connectionString, max: 2 });

try {
  const result = await runMigrations(pool, { directory, schema });
  console.log(JSON.stringify({ schema, applied: result.applied, alreadyApplied: result.alreadyApplied }));
} finally {
  await pool.end();
}
