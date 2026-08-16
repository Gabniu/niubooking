// Ownership: transport-level conventions shared by API and frontend clients.

export const tenantContextPath = (tenantId: string): string =>
  `/v1/tenant-context/${encodeURIComponent(tenantId)}`;

export const authorizedWorkspacesPath = (): string => "/v1/workspaces";

export const tenantContextErrorStatuses = {
  UNAUTHENTICATED: 401,
  TENANT_ACCESS_DENIED: 403,
} as const;
