// Ownership: tenant-scoped resource inventory and advisory availability. Commit conflicts remain PostgreSQL-owned.

import { findAvailableResourceSlots as planResourceSlots, validateResourceDraft, type AvailabilityWindow, type Resource, type ResourceAvailabilitySlot, type ResourceDraft } from "@bookingapp/domain";
import type { Pool } from "pg";
import { withTenantTransaction } from "./pg-executor.js";
import type { SqlExecutor } from "./tenant-membership.js";

interface ResourceRow { id: string; tenant_id: string; name: string; resource_type: string; capabilities?: readonly string[]; status: "active" | "inactive"; }
interface AllocationRow { resource_id: string; starts_at: Date; ends_at: Date; status: "scheduled" | "cancelled" | "completed"; }
function map(row: ResourceRow): Resource { return { id: row.id, tenantId: row.tenant_id, name: row.name, resourceType: row.resource_type, capabilities: row.capabilities ?? [], status: row.status }; }

export async function listResources(executor: SqlExecutor, tenantId: string): Promise<readonly Resource[]> {
  const rows = await executor.query<ResourceRow>("SELECT id, tenant_id, name, resource_type, capabilities, status FROM booking_resources WHERE tenant_id = $1 ORDER BY status, resource_type, name, id", [tenantId]);
  return rows.map(map);
}

export async function createResource(executor: SqlExecutor, resource: ResourceDraft): Promise<Resource> {
  const errors = validateResourceDraft(resource);
  if (errors.length) throw new Error(errors.join("; "));
  const rows = await executor.query<ResourceRow>("INSERT INTO booking_resources (id, tenant_id, name, resource_type, capabilities) VALUES ($1,$2,$3,$4,$5) RETURNING id, tenant_id, name, resource_type, capabilities, status", [resource.id, resource.tenantId, resource.name.trim(), resource.resourceType.trim(), [...(resource.capabilities ?? [])].map((capability) => capability.trim())]);
  if (!rows[0]) throw new Error("Resource creation returned no row");
  return map(rows[0]);
}

export async function setResourceStatus(executor: SqlExecutor, tenantId: string, resourceId: string, status: "active" | "inactive"): Promise<boolean> {
  const rows = await executor.query<{ id: string }>("UPDATE booking_resources SET status = $1, updated_at = now() WHERE tenant_id = $2 AND id = $3 RETURNING id", [status, tenantId, resourceId]);
  return rows.length > 0;
}

export async function findAvailableResources(executor: SqlExecutor, tenantId: string, window: AvailabilityWindow, requiredResourceCount = 1): Promise<readonly ResourceAvailabilitySlot[]> {
  const resources = await listResources(executor, tenantId);
  const allocations = await executor.query<AllocationRow>("SELECT resource_id, starts_at, ends_at, status FROM booking_resource_allocations WHERE tenant_id = $1 AND ends_at > $2 AND starts_at < $3", [tenantId, window.from, window.to]);
  return planResourceSlots(allocations.map((allocation) => ({ startsAt: new Date(allocation.starts_at), endsAt: new Date(allocation.ends_at), status: allocation.status, resourceIds: [allocation.resource_id] })), resources.map((resource) => ({ id: resource.id, active: resource.status === "active" })), window, requiredResourceCount);
}

export function createDatabaseResourceAdmin(pool: Pool) {
  return {
    list: (tenantId: string) => withTenantTransaction(pool, tenantId, (executor) => listResources(executor, tenantId)),
    create: (input: ResourceDraft) => withTenantTransaction(pool, input.tenantId, (executor) => createResource(executor, input)),
    setStatus: (tenantId: string, resourceId: string, status: "active" | "inactive") => withTenantTransaction(pool, tenantId, (executor) => setResourceStatus(executor, tenantId, resourceId, status)),
    availability: (tenantId: string, window: AvailabilityWindow, requiredResourceCount = 1) => withTenantTransaction(pool, tenantId, (executor) => findAvailableResources(executor, tenantId, window, requiredResourceCount)),
  };
}
