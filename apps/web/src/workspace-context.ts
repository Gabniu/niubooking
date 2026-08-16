// Ownership: typed tenant admission and selected-pack resolver shared by Next workspace surfaces.
import type { IndustryPacksResponse, IndustryPackSelectionResponse, TenantContextResponse } from "@bookingapp/contracts";

export type WorkspacePackSummary = NonNullable<NonNullable<IndustryPacksResponse["data"]>[number]>;
export type WorkspaceContextState =
  | { kind: "unauthenticated" | "denied" | "error"; message: string }
  | { kind: "ready"; tenantId: string; role: string; branchCount: number; pack: WorkspacePackSummary | null };
export type WorkspaceContextFetcher = (input: string, init: { credentials: "include" }) => Promise<{ json(): Promise<unknown> }>;

export async function loadWorkspaceContext(fetcher: WorkspaceContextFetcher, apiBase: string, tenantId: string): Promise<WorkspaceContextState> {
  const context = (await (await fetcher(`${apiBase}/v1/tenant-context/${encodeURIComponent(tenantId)}`, { credentials: "include" })).json()) as TenantContextResponse;
  if (!context.data) return { kind: context.error?.code === "TENANT_ACCESS_DENIED" ? "denied" : "unauthenticated", message: context.error?.message ?? "Sign in to continue." };
  let pack: WorkspacePackSummary | null = null;
  try {
    const selection = (await (await fetcher(`${apiBase}/v1/tenants/${encodeURIComponent(tenantId)}/industry-pack`, { credentials: "include" })).json()) as IndustryPackSelectionResponse;
    if (selection.data) {
      const catalog = (await (await fetcher(`${apiBase}/v1/industry-packs`, { credentials: "include" })).json()) as IndustryPacksResponse;
      pack = catalog.data?.find((item) => item.id === selection.data?.packId && item.version === selection.data?.packVersion) ?? null;
    }
  } catch {
    pack = null;
  }
  return { kind: "ready", tenantId: context.data.tenantId, role: context.data.role, branchCount: context.data.branchIds.length, pack };
}
