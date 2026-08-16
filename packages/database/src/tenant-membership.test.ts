// Ownership: tenant membership SQL tests prove parameterization and active-row filtering.

import assert from "node:assert/strict";
import test from "node:test";
import { listMemberships, readMembership, type SqlExecutor } from "./tenant-membership.js";

test("reads one active membership with tenant-scoped parameters", async () => {
  let captured: { sql: string; parameters: readonly unknown[] } | undefined;
  const executor: SqlExecutor = {
    query: async <T>(sql: string, parameters: readonly unknown[]) => {
      captured = { sql, parameters };
      return [{ user_id: "user-1", tenant_id: "tenant-1", branch_ids: ["branch-1"], role: "owner", status: "active" as const }] as T[];
    },
  };
  assert.deepEqual(await readMembership(executor, "user-1", "tenant-1"), {
    userId: "user-1", tenantId: "tenant-1", branchIds: ["branch-1"], role: "owner", status: "active",
  });
  assert.deepEqual(captured?.parameters, ["user-1", "tenant-1"]);
  assert.match(captured?.sql ?? "", /status = 'active'/);
});

test("returns null when PostgreSQL returns no active membership", async () => {
  const executor: SqlExecutor = { query: async () => [] };
  assert.equal(await readMembership(executor, "user-1", "tenant-1"), null);
});

test("lists active memberships in stable tenant order", async () => {
  let captured: { sql: string; parameters: readonly unknown[] } | undefined;
  const executor: SqlExecutor = { query: async <T>(sql: string, parameters: readonly unknown[]) => { captured = { sql, parameters }; return [
    { user_id: "user-1", tenant_id: "tenant-a", branch_ids: [], role: "owner", status: "active" as const },
    { user_id: "user-1", tenant_id: "tenant-b", branch_ids: ["branch-2"], role: "staff", status: "active" as const },
  ] as T[]; } };
  assert.deepEqual(await listMemberships(executor, "user-1"), [
    { userId: "user-1", tenantId: "tenant-a", branchIds: [], role: "owner", status: "active" },
    { userId: "user-1", tenantId: "tenant-b", branchIds: ["branch-2"], role: "staff", status: "active" },
  ]);
  assert.deepEqual(captured?.parameters, ["user-1"]);
  assert.match(captured?.sql ?? "", /status = 'active'/);
  assert.match(captured?.sql ?? "", /ORDER BY tenant_id ASC/);
});
