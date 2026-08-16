// Ownership: tenant-scoped canonical customer profiles. This adapter owns identity, not industry-specific attributes.

import type { CustomerProfile, CustomerStatus } from "@bookingapp/domain";
import type { SqlExecutor } from "./tenant-membership.js";

interface CustomerRow { id: string; tenant_id: string; display_name: string; preferred_locale: string | null; timezone: string | null; status: CustomerStatus; }
export interface CustomerProfileDraft { id: string; tenantId: string; displayName: string; preferredLocale?: string | null; timezone?: string | null; }
export interface CustomerProfileUpdate { tenantId: string; customerId: string; displayName: string; preferredLocale?: string | null; timezone?: string | null; }

function map(row: CustomerRow): CustomerProfile { return { id: row.id, tenantId: row.tenant_id, displayName: row.display_name, preferredLocale: row.preferred_locale, timezone: row.timezone, status: row.status }; }

export async function listCustomerProfiles(executor: SqlExecutor, tenantId: string, includeArchived = false): Promise<readonly CustomerProfile[]> {
  const rows = await executor.query<CustomerRow>("SELECT id, tenant_id, display_name, preferred_locale, timezone, status FROM customers WHERE tenant_id = $1 AND ($2 = true OR status = 'active') ORDER BY display_name, id", [tenantId, includeArchived]);
  return rows.map(map);
}

export async function createCustomerProfile(executor: SqlExecutor, profile: CustomerProfileDraft): Promise<CustomerProfile> {
  const displayName = profile.displayName.trim();
  if (!profile.id || !profile.tenantId || displayName.length < 1 || displayName.length > 200) throw new Error("Customer profile is invalid");
  const rows = await executor.query<CustomerRow>("INSERT INTO customers (id, tenant_id, display_name, preferred_locale, timezone) VALUES ($1,$2,$3,$4,$5) RETURNING id, tenant_id, display_name, preferred_locale, timezone, status", [profile.id, profile.tenantId, displayName, profile.preferredLocale ?? null, profile.timezone ?? null]);
  if (!rows[0]) throw new Error("Customer profile creation returned no row");
  return map(rows[0]);
}

export async function readCustomerProfile(executor: SqlExecutor, tenantId: string, customerId: string): Promise<CustomerProfile | null> {
  const rows = await executor.query<CustomerRow>("SELECT id, tenant_id, display_name, preferred_locale, timezone, status FROM customers WHERE tenant_id = $1 AND id = $2", [tenantId, customerId]);
  return rows[0] ? map(rows[0]) : null;
}

export async function updateCustomerProfile(executor: SqlExecutor, profile: CustomerProfileUpdate): Promise<CustomerProfile | null> {
  const displayName = profile.displayName.trim();
  if (!profile.tenantId || !profile.customerId || displayName.length < 1 || displayName.length > 200) throw new Error("Customer profile is invalid");
  const rows = await executor.query<CustomerRow>("UPDATE customers SET display_name = $1, preferred_locale = $2, timezone = $3, updated_at = now() WHERE tenant_id = $4 AND id = $5 RETURNING id, tenant_id, display_name, preferred_locale, timezone, status", [displayName, profile.preferredLocale ?? null, profile.timezone ?? null, profile.tenantId, profile.customerId]);
  return rows[0] ? map(rows[0]) : null;
}

export async function setCustomerProfileStatus(executor: SqlExecutor, tenantId: string, customerId: string, status: CustomerStatus): Promise<boolean> {
  const rows = await executor.query<{ id: string }>("UPDATE customers SET status = $1, updated_at = now() WHERE tenant_id = $2 AND id = $3 RETURNING id", [status, tenantId, customerId]);
  return rows.length > 0;
}
