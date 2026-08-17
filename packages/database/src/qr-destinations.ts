// Ownership: tenant-scoped QR persistence. Every mutation includes tenant scope and uses parameters.

import type { QrDestination, QrDestinationStatus } from "@bookingapp/domain";
import type { Pool } from "pg";
import { withTenantTransaction } from "./pg-executor.js";
import type { SqlExecutor } from "./tenant-membership.js";

interface QrRow {
  public_code: string;
  tenant_id: string;
  branch_id: string | null;
  pack_id: string | null;
  service_id: string | null;
  campaign: string | null;
  status: QrDestinationStatus;
  expires_at: Date | null;
}

function map(row: QrRow): QrDestination {
  return { publicCode: row.public_code, tenantId: row.tenant_id, branchId: row.branch_id, packId: row.pack_id, serviceId: row.service_id, campaign: row.campaign, status: row.status, expiresAt: row.expires_at };
}

const columns = "public_code, tenant_id, branch_id, pack_id, service_id, campaign, status, expires_at";

export async function readQrDestination(executor: SqlExecutor, publicCode: string): Promise<QrDestination | null> {
  const rows = await executor.query<QrRow>(`SELECT ${columns} FROM qr_destinations WHERE public_code = $1 LIMIT 1`, [publicCode]);
  return rows[0] ? map(rows[0]) : null;
}

export async function listQrDestinations(executor: SqlExecutor, tenantId: string): Promise<readonly QrDestination[]> {
  const rows = await executor.query<QrRow>(`SELECT ${columns} FROM qr_destinations WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
  return rows.map(map);
}

export async function createQrDestination(executor: SqlExecutor, input: Omit<QrDestination, "status">): Promise<QrDestination> {
  const rows = await executor.query<QrRow>(`INSERT INTO qr_destinations (${columns}) VALUES ($1,$2,$3,$4,$5,$6,'active',$7) RETURNING ${columns}`, [input.publicCode, input.tenantId, input.branchId, input.packId, input.serviceId, input.campaign, input.expiresAt]);
  if (!rows[0]) throw new Error("QR destination insert returned no row");
  return map(rows[0]);
}

export async function setQrDestinationStatus(executor: SqlExecutor, tenantId: string, publicCode: string, status: Exclude<QrDestinationStatus, "expired">): Promise<boolean> {
  const rows = await executor.query<{ public_code: string }>("UPDATE qr_destinations SET status = $1, updated_at = now() WHERE tenant_id = $2 AND public_code = $3 RETURNING public_code", [status, tenantId, publicCode]);
  return rows.length > 0;
}

export function createQrDestinationReader(pool: Pool) {
  return { findByPublicCode: async (publicCode: string): Promise<QrDestination | null> => { const result = await pool.query<QrRow>(`SELECT ${columns} FROM qr_destinations WHERE public_code = $1 LIMIT 1`, [publicCode]); return result.rows[0] ? map(result.rows[0]) : null; } };
}

export function createDatabaseQrAdmin(pool: Pool) {
  return {
    list: (tenantId: string) => withTenantTransaction(pool, tenantId, (executor) => listQrDestinations(executor, tenantId)),
    create: (input: Omit<QrDestination, "status">) => withTenantTransaction(pool, input.tenantId, (executor) => createQrDestination(executor, input)),
    setStatus: (tenantId: string, publicCode: string, status: Exclude<QrDestinationStatus, "expired">) => withTenantTransaction(pool, tenantId, (executor) => setQrDestinationStatus(executor, tenantId, publicCode, status)),
  };
}
