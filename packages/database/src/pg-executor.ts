// Ownership: PostgreSQL runtime adapter. Tenant context is transaction-local and never connection-global.

import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { SqlExecutor } from "./tenant-membership.js";

export function createPool(connectionString: string): Pool {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  return new Pool({ connectionString, max: 10 });
}

export function createSqlExecutor(client: PoolClient): SqlExecutor {
  return {
    query: async <T>(sql: string, parameters: readonly unknown[]) => {
      const result = await client.query<QueryResultRow & T>(sql, [...parameters]);
      return result.rows as readonly T[];
    },
  };
}

export function createPoolExecutor(pool: Pool): SqlExecutor {
  return {
    query: async <T>(sql: string, parameters: readonly unknown[]) => {
      const result = await pool.query<QueryResultRow & T>(sql, [...parameters]);
      return result.rows as readonly T[];
    },
  };
}

export async function withTenantTransaction<T>(
  pool: Pool,
  tenantId: string,
  work: (executor: SqlExecutor) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('booking.tenant_id', $1, true)", [tenantId]);
    const result = await work(createSqlExecutor(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function withPublicTransaction<T>(pool: Pool, work: (executor: SqlExecutor) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('booking.public_feed', 'true', true)");
    const result = await work(createSqlExecutor(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
