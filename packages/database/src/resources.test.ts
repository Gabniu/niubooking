import assert from "node:assert/strict";
import test from "node:test";
import { createResource, findAvailableResources, listResources, setResourceStatus } from "./resources.js";

const resource = { id: "room-1", tenant_id: "tenant-1", name: "Room 1", resource_type: "room", status: "active" as const };

test("lists, creates, and changes a tenant resource", async () => {
  const executor = { query: async <T>() => [resource] as T[] };
  assert.equal((await listResources(executor, "tenant-1"))[0]?.name, "Room 1");
  assert.equal((await createResource(executor, { id: "room-1", tenantId: "tenant-1", name: "Room 1", resourceType: "room" })).status, "active");
  assert.equal(await setResourceStatus(executor, "tenant-1", "room-1", "inactive"), true);
});

test("plans availability from tenant resource allocations", async () => {
  const executor = { query: async <T>(sql: string) => sql.startsWith("SELECT id, tenant_id") ? [resource] as T[] : [] as T[] };
  const from = new Date("2026-08-14T09:00:00Z");
  const slots = await findAvailableResources(executor, "tenant-1", { from, to: new Date("2026-08-14T10:00:00Z"), durationMinutes: 30, stepMinutes: 30 });
  assert.equal(slots.length, 2);
  assert.deepEqual(slots[0]?.resourceIds, ["room-1"]);
});
