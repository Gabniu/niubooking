// Ownership: typed organization contact-method client. It never exposes raw destinations after loading.

import type { CommunicationChannel } from "@bookingapp/domain";
import type { ContactConsentStatus, CustomerContactMethodResponse, CustomerContactMethodSummary } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type ContactMethodsState = { kind: "ready"; methods: readonly CustomerContactMethodSummary[] } | { kind: "denied" | "error"; message: string };
export type ContactMethodsFetcher = (url: string, init: { credentials: "include"; method?: "POST"; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

function mapResponse(response: { status: number }, body: CustomerContactMethodResponse): ContactMethodsState {
  if (body.data) return { kind: "ready", methods: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to contact methods.") };
  return { kind: "error", message: userFacingMessage(response.status, body.error, "We could not load contact methods.") };
}

export async function fetchContactMethods(fetcher: ContactMethodsFetcher, baseUrl: string, tenantId: string): Promise<ContactMethodsState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/contact-methods`, { credentials: "include" });
  return mapResponse(response, (await response.json()) as CustomerContactMethodResponse);
}

export async function saveContactMethod(fetcher: ContactMethodsFetcher, baseUrl: string, tenantId: string, input: { customerId: string; channel: CommunicationChannel; destination: string; consentStatus: ContactConsentStatus }): Promise<ContactMethodsState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/contact-methods`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  if (response.status === 204) return fetchContactMethods(fetcher, baseUrl, tenantId);
  return mapResponse(response, (await response.json()) as CustomerContactMethodResponse);
}
