// Ownership: compact client for advisory, requirement-aware candidate times.

import type { RequirementAvailabilityResponse } from "@bookingapp/contracts";
import type { ServiceFetcher } from "./services-client.js";
import { userFacingMessage } from "./user-messages.js";

export type RequirementAvailabilityState = { kind: "ready"; data: NonNullable<RequirementAvailabilityResponse["data"]> } | { kind: "denied" | "error"; message: string };
export async function fetchRequirementAvailability(fetcher: ServiceFetcher, baseUrl: string, tenantId: string, serviceId: string, input: { from: string; to: string; durationMinutes: number; stepMinutes: number; variantId?: string | null }): Promise<RequirementAvailabilityState> {
  const query = new URLSearchParams({ from: input.from, to: input.to, durationMinutes: String(input.durationMinutes), stepMinutes: String(input.stepMinutes) }); if (input.variantId) query.set("variantId", input.variantId);
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/services/${encodeURIComponent(serviceId)}/requirement-availability?${query}`, { credentials: "include" }); const body = (await response.json()) as RequirementAvailabilityResponse;
  if (body.data) return { kind: "ready", data: body.data }; if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to availability.") }; return { kind: "error", message: userFacingMessage(response.status, body.error, "We could not load availability.") };
}
