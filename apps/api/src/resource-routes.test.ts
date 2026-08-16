import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "./server.js";

const identity = { issuer: "https://novaauth.niuautomations.com", subject: "sub-1" };
const membership = { userId: "user-1", tenantId: "tenant-1", branchIds: [], role: "owner", status: "active" as const };
const resolve = (request: { params: { tenantId: string } }) => ({ identity, mappedUserId: "user-1", membership, requestedTenantId: request.params.tenantId });

test("lists and creates tenant resources through the real HTTP contract", async () => {
  const app = createApiServer({ resolve, resourceAdmin: { list: async () => [{ id: "room-1" }], create: async (input) => input, setStatus: async () => true, availability: async () => [] } });
  assert.equal((await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/resources" })).statusCode, 200);
  const response = await app.inject({ method: "POST", url: "/v1/tenants/tenant-1/resources", payload: { name: "Room 1", resourceType: "room" } });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.name, "Room 1");
});

test("returns advisory availability with serialized slots and rejects invalid windows", async () => {
  const app = createApiServer({ resolve, resourceAdmin: { list: async () => [], create: async (input) => input, setStatus: async () => true, availability: async () => [{ startsAt: new Date("2026-08-14T09:00:00Z"), endsAt: new Date("2026-08-14T09:30:00Z"), resourceIds: ["room-1"] }] } });
  const valid = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/availability?from=2026-08-14T09:00:00Z&to=2026-08-14T10:00:00Z" });
  assert.deepEqual(valid.json().data[0], { startsAt: "2026-08-14T09:00:00.000Z", endsAt: "2026-08-14T09:30:00.000Z", resourceIds: ["room-1"] });
  const invalid = await app.inject({ method: "GET", url: "/v1/tenants/tenant-1/availability?from=bad&to=bad" });
  assert.equal(invalid.statusCode, 400);
});
