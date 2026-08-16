// Ownership: tenant admission domain policy. It is framework-free by design.

export type MembershipStatus = "active" | "suspended" | "revoked";

export interface IdentitySubject {
  issuer: string;
  subject: string;
}

export interface LocalMembership {
  userId: string;
  tenantId: string;
  branchIds: readonly string[];
  role: string;
  status: MembershipStatus;
}

export interface TenantContext {
  userId: string;
  tenantId: string;
  branchIds: readonly string[];
  role: string;
}

export type AdmissionResult =
  | { allowed: true; context: TenantContext }
  | { allowed: false; reason: "identity_not_mapped" | "membership_inactive" | "tenant_mismatch" };

export function admitTenant(
  identity: IdentitySubject,
  mappedUserId: string | null,
  membership: LocalMembership | null,
  requestedTenantId: string,
): AdmissionResult {
  if (!mappedUserId || identity.subject.length === 0 || identity.issuer.length === 0) {
    return { allowed: false, reason: "identity_not_mapped" };
  }
  if (!membership || membership.userId !== mappedUserId || membership.status !== "active") {
    return { allowed: false, reason: "membership_inactive" };
  }
  if (membership.tenantId !== requestedTenantId) {
    return { allowed: false, reason: "tenant_mismatch" };
  }
  return {
    allowed: true,
    context: {
      userId: mappedUserId,
      tenantId: membership.tenantId,
      branchIds: membership.branchIds,
      role: membership.role,
    },
  };
}
