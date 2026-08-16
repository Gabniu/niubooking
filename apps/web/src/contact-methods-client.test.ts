import assert from "node:assert/strict";
import test from "node:test";
import { fetchContactMethods, saveContactMethod } from "./contact-methods-client.js";

test("loads masked contact methods from the tenant API", async () => {
  const state = await fetchContactMethods(async (url) => ({ ok: true, status: 200, json: async () => ({ data: [{ id: "c-1", customerId: "customer-1", customerName: "Alex Morgan", channel: "email", maskedDestination: "p•••@example.test", consentStatus: "granted", verifiedAt: null, enabled: true, priority: 1 }], error: null }) }), "", "tenant-1");
  assert.equal(state.kind, "ready");
  assert.equal(state.methods[0]?.maskedDestination, "p•••@example.test");
});

test("saves a contact method then reloads the masked list", async () => {
  let calls = 0;
  const state = await saveContactMethod(async (_url, init) => { calls += 1; assert.equal(init.method, calls === 1 ? "POST" : undefined); return { ok: true, status: calls === 1 ? 204 : 200, json: async () => ({ data: [], error: null }) }; }, "", "tenant-1", { customerId: "customer-1", channel: "sms", destination: "+254700000000", consentStatus: "granted" });
  assert.equal(state.kind, "ready");
  assert.equal(calls, 2);
});
