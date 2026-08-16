// Ownership: contract-facing API tests for local admission and response shape.

import assert from "node:assert/strict";
import test from "node:test";
import { getTenantContext } from "./tenant-context-handler.js";

const request = {
  identity: { issuer: "https://novaauth.niuautomations.com", subject: "sub-1" },
  mappedUserId: "user-1",
  membership: {
    userId: "user-1",
    tenantId: "tenant-1",
    branchIds: ["branch-1"],
    role: "owner",
    status: "active" as const,
  },
  requestedTenantId: "tenant-1",
};

test("returns a tenant context consumed by the shell", () => {
  assert.deepEqual(getTenantContext(request), {
    data: { tenantId: "tenant-1", userId: "user-1", role: "owner", branchIds: ["branch-1"] },
    error: null,
  });
});

test("does not disclose cross-tenant details", () => {
  const result = getTenantContext({ ...request, requestedTenantId: "tenant-2" });
  assert.deepEqual(result, {
    data: null,
    error: { code: "TENANT_ACCESS_DENIED", message: "You do not have access to this workspace." },
  });
});
