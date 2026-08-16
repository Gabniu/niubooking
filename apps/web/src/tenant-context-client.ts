// Ownership: frontend HTTP client for the tenant-context contract; it never fabricates production data.

import { tenantContextPath, type TenantContextResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export interface ResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (input: string, init?: { credentials: "include" }) => Promise<ResponseLike>;

export async function fetchTenantContext(
  fetcher: FetchLike,
  baseUrl: string,
  tenantId: string,
): Promise<TenantContextResponse> {
  const response = await fetcher(`${baseUrl}${tenantContextPath(tenantId)}`, { credentials: "include" });
  const body = (await response.json()) as TenantContextResponse;
  if (!response.ok && !body.error) throw new Error(userFacingMessage(response.status, null, "We could not load this workspace."));
  return body;
}
