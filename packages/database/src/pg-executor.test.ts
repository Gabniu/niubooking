// Ownership: transaction-local tenant context tests prevent connection-pool leakage.

import assert from "node:assert/strict";
import test from "node:test";
import { withTenantTransaction } from "./pg-executor.js";

test("sets tenant context inside a transaction and releases the client", async () => {
  const calls: string[] = [];
  const client = {
    query: async (sql: string) => { calls.push(sql); return { rows: [] }; },
    release: () => calls.push("RELEASE"),
  };
  const pool = { connect: async () => client };
  const result = await withTenantTransaction(pool as never, "tenant-1", async () => "ok");
  assert.equal(result, "ok");
  assert.deepEqual(calls, ["BEGIN", "SELECT set_config('booking.tenant_id', $1, true)", "COMMIT", "RELEASE"]);
});

test("rolls back and releases when the transaction fails", async () => {
  const calls: string[] = [];
  const client = {
    query: async (sql: string) => { calls.push(sql); return { rows: [] }; },
    release: () => calls.push("RELEASE"),
  };
  await assert.rejects(() => withTenantTransaction({ connect: async () => client } as never, "tenant-1", async () => {
    throw new Error("failure");
  }), /failure/);
  assert.deepEqual(calls, ["BEGIN", "SELECT set_config('booking.tenant_id', $1, true)", "ROLLBACK", "RELEASE"]);
});
