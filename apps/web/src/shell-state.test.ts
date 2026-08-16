// Ownership: frontend parity tests for API response states and honest rendering.

import assert from "node:assert/strict";
import test from "node:test";
import { tenantContextFailure, tenantContextSuccess } from "@bookingapp/contracts";
import { toShellState } from "./shell-state.js";

test("maps real tenant data to the ready shell state", () => {
  assert.deepEqual(
    toShellState(tenantContextSuccess({ tenantId: "tenant-1", userId: "user-1", role: "owner", branchIds: ["b-1"] })),
    { kind: "ready", tenantName: "tenant-1", role: "owner", branchCount: 1 },
  );
});

test("maps access denial to a recoverable non-data state", () => {
  assert.deepEqual(toShellState(tenantContextFailure("TENANT_ACCESS_DENIED")), {
    kind: "denied",
    message: "You do not have access to this workspace.",
  });
});
