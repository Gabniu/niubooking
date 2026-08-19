// Ownership: deterministic live-location capability and data-scope authorization.

export type FleetLocationCapability =
  | "fleet.location.view.organization"
  | "fleet.location.view.branch"
  | "fleet.location.view.assigned"
  | "fleet.location.dispatch"
  | "fleet.location.publish.assigned"
  | "fleet.location.history"
  | "fleet.location.manage.devices"
  | "fleet.location.manage.retention";

export type FleetLocationScope = "organization" | "branch" | "assigned";

export interface FleetLocationViewer {
  readonly tenantId: string;
  readonly userId: string;
  readonly capabilities: readonly FleetLocationCapability[];
  readonly branchIds: readonly string[];
  readonly assignedTripIds: readonly string[];
}

export interface FleetLocationResource {
  readonly tenantId: string;
  readonly branchId: string;
  readonly tripId: string;
}

export type FleetLocationAccessDecision =
  | { readonly allowed: true; readonly scope: FleetLocationScope }
  | {
      readonly allowed: false;
      readonly reason: "tenant_mismatch" | "permission_missing" | "scope_mismatch";
    };

const roleTemplates = {
  owner: [
    "fleet.location.view.organization",
    "fleet.location.view.branch",
    "fleet.location.dispatch",
    "fleet.location.history",
    "fleet.location.manage.devices",
    "fleet.location.manage.retention",
  ],
  admin: ["fleet.location.view.branch", "fleet.location.dispatch"],
  manager: ["fleet.location.view.branch"],
  dispatcher: ["fleet.location.view.branch", "fleet.location.dispatch"],
  driver: ["fleet.location.view.assigned", "fleet.location.publish.assigned"],
  conductor: ["fleet.location.view.assigned"],
} as const satisfies Record<string, readonly FleetLocationCapability[]>;

/** Role templates seed grants; request authorization consumes resolved capabilities. */
export function fleetLocationRoleTemplate(role: string): readonly FleetLocationCapability[] {
  return role in roleTemplates
    ? [...roleTemplates[role as keyof typeof roleTemplates]]
    : [];
}

export function authorizeFleetLocationView(
  viewer: FleetLocationViewer,
  resource: FleetLocationResource,
): FleetLocationAccessDecision {
  if (viewer.tenantId !== resource.tenantId) {
    return { allowed: false, reason: "tenant_mismatch" };
  }
  const capabilities = new Set(viewer.capabilities);
  if (capabilities.has("fleet.location.view.organization")) {
    return { allowed: true, scope: "organization" };
  }
  if (capabilities.has("fleet.location.view.branch")) {
    return viewer.branchIds.includes(resource.branchId)
      ? { allowed: true, scope: "branch" }
      : { allowed: false, reason: "scope_mismatch" };
  }
  if (capabilities.has("fleet.location.view.assigned")) {
    return viewer.assignedTripIds.includes(resource.tripId)
      ? { allowed: true, scope: "assigned" }
      : { allowed: false, reason: "scope_mismatch" };
  }
  return { allowed: false, reason: "permission_missing" };
}

export function canPublishAssignedTrip(
  viewer: FleetLocationViewer,
  resource: FleetLocationResource,
): boolean {
  return viewer.tenantId === resource.tenantId
    && viewer.capabilities.includes("fleet.location.publish.assigned")
    && viewer.assignedTripIds.includes(resource.tripId);
}
