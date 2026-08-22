// Ownership: human workspace labels; tenant identifiers remain action-only references.

export function workspaceDisplayName(index: number, total: number): string {
  return total === 1 ? "Your authorized organization" : `Authorized organization ${index + 1}`;
}

export function workspaceReference(tenantId: string): string {
  return `Workspace reference: ${tenantId}`;
}
