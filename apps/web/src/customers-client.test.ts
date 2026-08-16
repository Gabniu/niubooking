import assert from "node:assert/strict";
import test from "node:test";
import { createCustomer, fetchCustomer, fetchCustomers, setCustomerStatus, updateCustomer } from "./customers-client.js";

test("loads real customer profiles from the tenant API", async () => {
  const state = await fetchCustomers(async (url) => { assert.match(url, /customers$/); return { status: 200, json: async () => ({ data: [{ id: "customer-1", tenantId: "tenant-1", displayName: "Alex Morgan", preferredLocale: null, timezone: null, status: "active" }], error: null }) }; }, "", "tenant-1");
  assert.equal(state.kind, "ready");
  assert.equal(state.customers[0]?.displayName, "Alex Morgan");
});

test("creates a customer through the typed API", async () => {
  const state = await createCustomer(async (_url, init) => { assert.equal(init.method, "POST"); return { status: 201, json: async () => ({ data: { id: "customer-1", tenantId: "tenant-1", displayName: "Jamie Lee", preferredLocale: null, timezone: null, status: "active" }, error: null }) }; }, "", "tenant-1", "Jamie Lee");
  assert.equal(state.kind, "ready");
  assert.equal(state.customer.id, "customer-1");
});

test("changes a customer status through the typed API", async () => {
  const state = await setCustomerStatus(async (_url, init) => { assert.equal(init.method, "POST"); return { status: 200, json: async () => ({ data: { customerId: "customer-1", status: "archived" }, error: null }) }; }, "", "tenant-1", "customer-1", "archived");
  assert.equal(state.kind, "ready");
});

test("reads and updates a customer through the typed API", async () => {
  const fetcher = async (_url: string, init: { method?: string }) => { assert.equal(init.method, "PUT"); return { status: 200, json: async () => ({ data: { id: "customer-1", tenantId: "tenant-1", displayName: "Jamie Lee", preferredLocale: null, timezone: null, status: "active" }, error: null }) }; };
  const state = await updateCustomer(fetcher, "", "tenant-1", "customer-1", "Jamie Lee");
  assert.equal(state.kind, "ready");
  const read = await fetchCustomer(async (_url, init) => { assert.equal(init.method, undefined); return { status: 200, json: async () => ({ data: { id: "customer-1", tenantId: "tenant-1", displayName: "Jamie Lee", preferredLocale: null, timezone: null, status: "active" }, error: null }) }; }, "", "tenant-1", "customer-1");
  assert.equal(read.kind, "ready");
});
