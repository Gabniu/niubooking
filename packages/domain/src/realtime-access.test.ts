// Ownership: live-location authorization matrix and fail-closed scope proof.

import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeFleetLocationView,
  canPublishAssignedTrip,
  fleetLocationRoleTemplate,
  type FleetLocationViewer,
} from "./realtime-access.js";

const resource = { tenantId: "tenant-1", branchId: "branch-1", tripId: "trip-1" };

function viewer(
  role: string,
  input: Partial<FleetLocationViewer> = {},
): FleetLocationViewer {
  return {
    tenantId: "tenant-1",
    userId: `${role}-1`,
    capabilities: fleetLocationRoleTemplate(role),
    branchIds: [],
    assignedTripIds: [],
    ...input,
  };
}

test("owners can view the organization without relying on an empty branch list", () => {
  assert.deepEqual(authorizeFleetLocationView(viewer("owner"), resource), {
    allowed: true,
    scope: "organization",
  });
});

test("admins and managers need the matching explicit branch", () => {
  assert.deepEqual(
    authorizeFleetLocationView(viewer("admin", { branchIds: ["branch-1"] }), resource),
    { allowed: true, scope: "branch" },
  );
  assert.deepEqual(authorizeFleetLocationView(viewer("manager"), resource), {
    allowed: false,
    reason: "scope_mismatch",
  });
  assert.deepEqual(
    authorizeFleetLocationView(viewer("manager", { branchIds: ["branch-2"] }), resource),
    { allowed: false, reason: "scope_mismatch" },
  );
});

test("an explicitly granted admin can receive organization scope", () => {
  const admin = viewer("admin", {
    capabilities: ["fleet.location.view.organization"],
  });
  assert.deepEqual(authorizeFleetLocationView(admin, resource), {
    allowed: true,
    scope: "organization",
  });
});

test("drivers and conductors see only their assigned trip", () => {
  const driver = viewer("driver", { assignedTripIds: ["trip-1"] });
  const conductor = viewer("conductor", { assignedTripIds: ["trip-2"] });
  assert.deepEqual(authorizeFleetLocationView(driver, resource), {
    allowed: true,
    scope: "assigned",
  });
  assert.deepEqual(authorizeFleetLocationView(conductor, resource), {
    allowed: false,
    reason: "scope_mismatch",
  });
  assert.equal(canPublishAssignedTrip(driver, resource), true);
  assert.equal(canPublishAssignedTrip(viewer("conductor", { assignedTripIds: ["trip-1"] }), resource), false);
});

test("cross-tenant and unknown roles fail closed", () => {
  assert.deepEqual(
    authorizeFleetLocationView(viewer("owner", { tenantId: "tenant-2" }), resource),
    { allowed: false, reason: "tenant_mismatch" },
  );
  assert.deepEqual(authorizeFleetLocationView(viewer("support"), resource), {
    allowed: false,
    reason: "permission_missing",
  });
});
