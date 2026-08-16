// Ownership: API composition seam for tenant context. HTTP framework wiring is intentionally separate.

import { tenantContextFailure, tenantContextSuccess, type TenantContextResponse } from "@bookingapp/contracts";
import { admitTenant, type IdentitySubject, type LocalMembership } from "@bookingapp/domain";

export interface TenantContextRequest {
  identity: IdentitySubject | null;
  mappedUserId: string | null;
  membership: LocalMembership | null;
  requestedTenantId: string;
}

export function getTenantContext(request: TenantContextRequest): TenantContextResponse {
  if (!request.identity) return tenantContextFailure("UNAUTHENTICATED");
  const result = admitTenant(
    request.identity,
    request.mappedUserId,
    request.membership,
    request.requestedTenantId,
  );
  if (!result.allowed) return tenantContextFailure("TENANT_ACCESS_DENIED");
  return tenantContextSuccess(result.context);
}
