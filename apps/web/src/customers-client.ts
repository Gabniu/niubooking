// Ownership: typed tenant customer-profile client. It never fabricates customer records.

import type { CustomerProfileResponse, CustomerProfilesResponse, CustomerProfileSummary, CustomerProfileStatus, CustomerStatusResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type CustomersState = { kind: "ready"; customers: readonly CustomerProfileSummary[] } | { kind: "denied" | "error"; message: string };
export type CustomerState = { kind: "ready"; customer: CustomerProfileSummary } | { kind: "denied" | "error"; message: string };
export type CustomersFetcher = (url: string, init: { credentials: "include"; method?: "POST" | "PUT"; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; json(): Promise<unknown> }>;

function message(status: number, error?: { code?: string; message?: string }): string { return userFacingMessage(status, error, "We could not load customer profiles."); }
export async function fetchCustomers(fetcher: CustomersFetcher, baseUrl: string, tenantId: string, includeArchived = false): Promise<CustomersState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/customers${includeArchived ? "?includeArchived=true" : ""}`, { credentials: "include" });
  const body = (await response.json()) as CustomerProfilesResponse;
  if (body.data) return { kind: "ready", customers: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to customer profiles.") };
  return { kind: "error", message: message(response.status, body.error ?? undefined) };
}

export async function createCustomer(fetcher: CustomersFetcher, baseUrl: string, tenantId: string, displayName: string, preferredLocale: string | null = null, timezone: string | null = null): Promise<CustomerState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/customers`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName, preferredLocale, timezone }) });
  const body = (await response.json()) as CustomerProfileResponse;
  if (body.data) return { kind: "ready", customer: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to customer profiles.") };
  return { kind: "error", message: message(response.status, body.error ?? undefined) };
}

export async function fetchCustomer(fetcher: CustomersFetcher, baseUrl: string, tenantId: string, customerId: string): Promise<CustomerState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/customers/${encodeURIComponent(customerId)}`, { credentials: "include" });
  const body = (await response.json()) as CustomerProfileResponse;
  if (body.data) return { kind: "ready", customer: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to customer profiles.") };
  return { kind: "error", message: message(response.status, body.error ?? undefined) };
}

export async function updateCustomer(fetcher: CustomersFetcher, baseUrl: string, tenantId: string, customerId: string, displayName: string, preferredLocale: string | null = null, timezone: string | null = null): Promise<CustomerState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/customers/${encodeURIComponent(customerId)}`, { credentials: "include", method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName, preferredLocale, timezone }) });
  const body = (await response.json()) as CustomerProfileResponse;
  if (body.data) return { kind: "ready", customer: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to customer profiles.") };
  return { kind: "error", message: message(response.status, body.error ?? undefined) };
}

export async function setCustomerStatus(fetcher: CustomersFetcher, baseUrl: string, tenantId: string, customerId: string, status: CustomerProfileStatus): Promise<{ kind: "ready" } | { kind: "denied" | "error"; message: string }> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/customers/${encodeURIComponent(customerId)}/status`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
  const body = (await response.json()) as CustomerStatusResponse;
  if (body.data) return { kind: "ready" };
  if (body.error?.code === "TENANT_ACCESS_DENIED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to customer profiles.") };
  return { kind: "error", message: message(response.status, body.error ?? undefined) };
}
