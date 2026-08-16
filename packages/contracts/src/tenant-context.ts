// Ownership: versioned transport contract for the first real shell-backed endpoint.

export interface TenantContextResponse {
  data: {
    tenantId: string;
    userId: string;
    role: string;
    branchIds: string[];
  } | null;
  error: { code: "UNAUTHENTICATED" | "TENANT_ACCESS_DENIED"; message: string } | null;
}

export function tenantContextSuccess(input: {
  tenantId: string;
  userId: string;
  role: string;
  branchIds: readonly string[];
}): TenantContextResponse {
  return {
    data: { ...input, branchIds: [...input.branchIds] },
    error: null,
  };
}

export function tenantContextFailure(
  code: "UNAUTHENTICATED" | "TENANT_ACCESS_DENIED",
): TenantContextResponse {
  return {
    data: null,
    error: {
      code,
      message: code === "UNAUTHENTICATED" ? "Sign in to continue." : "You do not have access to this workspace.",
    },
  };
}
