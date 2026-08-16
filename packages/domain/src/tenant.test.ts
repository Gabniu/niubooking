// Ownership: tenant admission regression tests for the walking skeleton.

import assert from "node:assert/strict";
import test from "node:test";
import { admitTenant } from "./tenant.js";

const identity = { issuer: "https://novaauth.niuautomations.com", subject: "sub-1" };
const membership = {
  userId: "user-1",
  tenantId: "tenant-1",
  branchIds: ["branch-1"],
  role: "owner",
  status: "active" as const,
};

test("admits an active local member for the requested tenant", () => {
  const result = admitTenant(identity, "user-1", membership, "tenant-1");
  assert.equal(result.allowed, true);
});

test("denies an otherwise valid identity without local membership", () => {
  const result = admitTenant(identity, "user-1", null, "tenant-1");
  assert.deepEqual(result, { allowed: false, reason: "membership_inactive" });
});

test("denies a cross-tenant request", () => {
  const result = admitTenant(identity, "user-1", membership, "tenant-2");
  assert.deepEqual(result, { allowed: false, reason: "tenant_mismatch" });
});
