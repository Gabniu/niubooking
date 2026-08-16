// Ownership: tenant membership persistence port. SQL is explicit so tenant scoping stays reviewable.

import type { LocalMembership } from "@bookingapp/domain";

export interface SqlExecutor {
  query<T>(sql: string, parameters: readonly unknown[]): Promise<readonly T[]>;
}

export interface MembershipRow {
  user_id: string;
  tenant_id: string;
  branch_ids: string[];
  role: string;
  status: LocalMembership["status"];
}

export async function readMembership(
  executor: SqlExecutor,
  userId: string,
  tenantId: string,
): Promise<LocalMembership | null> {
  const rows = await executor.query<MembershipRow>(
    `SELECT user_id, tenant_id, branch_ids, role, status
       FROM tenant_memberships
      WHERE user_id = $1 AND tenant_id = $2 AND status = 'active'
      LIMIT 1`,
    [userId, tenantId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    userId: row.user_id,
    tenantId: row.tenant_id,
    branchIds: [...row.branch_ids],
    role: row.role,
    status: row.status,
  };
}

export async function listMemberships(
  executor: SqlExecutor,
  userId: string,
): Promise<readonly LocalMembership[]> {
  const rows = await executor.query<MembershipRow>(
    `SELECT user_id, tenant_id, branch_ids, role, status
       FROM tenant_memberships
      WHERE user_id = $1 AND status = 'active'
      ORDER BY tenant_id ASC`,
    [userId],
  );
  return rows.map((row) => ({ userId: row.user_id, tenantId: row.tenant_id, branchIds: [...row.branch_ids], role: row.role, status: row.status }));
}
