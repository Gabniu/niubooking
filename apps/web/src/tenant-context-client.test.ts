// Ownership: frontend/API parity tests for the real HTTP contract client.

import assert from "node:assert/strict";
import test from "node:test";
import { fetchTenantContext } from "./tenant-context-client.js";

test("requests the encoded backend tenant-context route with session credentials", async () => {
  let requested = "";
  const result = await fetchTenantContext(async (input, init) => {
    requested = `${input}|${init?.credentials}`;
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { tenantId: "tenant/1", userId: "u-1", role: "owner", branchIds: [] }, error: null }),
    };
  }, "http://localhost:3000", "tenant/1");
  assert.equal(requested, "http://localhost:3000/v1/tenant-context/tenant%2F1|include");
  assert.equal(result.data?.tenantId, "tenant/1");
});
