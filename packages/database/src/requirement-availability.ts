// Ownership: tenant-scoped advisory matching. Final booking confirmation remains PostgreSQL-owned.

import { findRequirementAvailability, type AvailabilityWindow, type RequirementAvailabilityResult } from "@bookingapp/domain";
import type { Pool } from "pg";
import { withTenantTransaction } from "./pg-executor.js";
import { listServiceRequirements } from "./service-variants.js";
import { listResources } from "./resources.js";
import type { SqlExecutor } from "./tenant-membership.js";

interface AllocationRow { resource_id: string; starts_at: Date; ends_at: Date; status: "scheduled" | "cancelled" | "completed"; }

export async function findServiceRequirementAvailability(executor: SqlExecutor, tenantId: string, serviceId: string, variantId: string | null | undefined, window: AvailabilityWindow): Promise<RequirementAvailabilityResult> {
  const [requirements, resources, allocations] = await Promise.all([
    listServiceRequirements(executor, tenantId, serviceId, variantId),
    listResources(executor, tenantId),
    executor.query<AllocationRow>("SELECT resource_id, starts_at, ends_at, status FROM booking_resource_allocations WHERE tenant_id = $1 AND ends_at > $2 AND starts_at < $3", [tenantId, window.from, window.to]),
  ]);
  return findRequirementAvailability(requirements.filter((requirement) => requirement.status === "active"), resources.map((resource) => ({ id: resource.id, resourceType: resource.resourceType, capabilities: resource.capabilities ?? [], active: resource.status === "active" })), allocations.map((allocation) => ({ resourceId: allocation.resource_id, startsAt: new Date(allocation.starts_at), endsAt: new Date(allocation.ends_at), status: allocation.status })), window);
}

export function createDatabaseRequirementAvailabilityAdmin(pool: Pool) {
  return { find: (tenantId: string, serviceId: string, variantId: string | null | undefined, window: AvailabilityWindow) => withTenantTransaction(pool, tenantId, (executor) => findServiceRequirementAvailability(executor, tenantId, serviceId, variantId, window)) };
}
