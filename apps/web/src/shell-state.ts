// Ownership: frontend state adapter for the first real tenant-context surface.

import type { TenantContextResponse } from "@bookingapp/contracts";

export type ShellState =
  | { kind: "loading" }
  | { kind: "ready"; tenantName: string; role: string; branchCount: number }
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string };

export function toShellState(response: TenantContextResponse): ShellState {
  if (response.data) {
    return {
      kind: "ready",
      tenantName: response.data.tenantId,
      role: response.data.role,
      branchCount: response.data.branchIds.length,
    };
  }
  if (response.error?.code === "TENANT_ACCESS_DENIED") {
    return { kind: "denied", message: response.error.message };
  }
  return { kind: "error", message: response.error?.message ?? "Something went wrong." };
}
