// Ownership: authorized workspace-picker contract; it exposes only local access metadata.

export interface AuthorizedWorkspace {
  tenantId: string;
  branchIds: readonly string[];
  role: string;
}

export interface AuthorizedWorkspacesResponse {
  data: readonly AuthorizedWorkspace[] | null;
  error: { code: "UNAUTHENTICATED" | "WORKSPACES_UNAVAILABLE"; message: string } | null;
}

export function authorizedWorkspacesSuccess(data: readonly AuthorizedWorkspace[]): AuthorizedWorkspacesResponse {
  return { data, error: null };
}

export function authorizedWorkspacesFailure(code: "UNAUTHENTICATED" | "WORKSPACES_UNAVAILABLE"): AuthorizedWorkspacesResponse {
  return { data: null, error: { code, message: code === "UNAUTHENTICATED" ? "Sign in to choose a workspace." : "Your workspaces are temporarily unavailable." } };
}
