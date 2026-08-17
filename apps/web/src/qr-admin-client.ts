// Ownership: authenticated staff QR destination client; UI never invents destination records.

import { type QrDestinationListResponse, type QrDestinationResponse, type QrDestinationRotateResponse, type QrDestinationStatusResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type QrAdminState =
  | { kind: "loading" }
  | { kind: "ready"; destinations: NonNullable<QrDestinationListResponse["data"]> }
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string };

export interface AdminFetchLike {
  (input: string, init?: { credentials: "include"; method?: "POST"; headers?: Record<string, string>; body?: string }): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

export async function createQrDestination(fetcher: AdminFetchLike, baseUrl: string, tenantId: string, input: { branchId?: string | null; packId?: string | null; serviceId?: string | null; campaign?: string | null; expiresAt?: string | null }): Promise<{ kind: "ready"; destination: NonNullable<QrDestinationResponse["data"]> } | { kind: "error"; message: string }> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/qr-destinations`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  const body = (await response.json()) as QrDestinationResponse;
  return body.data ? { kind: "ready", destination: body.data } : { kind: "error", message: userFacingMessage(response.status, body.error, "We could not create that booking link.") };
}

export async function setQrDestinationStatus(fetcher: AdminFetchLike, baseUrl: string, tenantId: string, publicCode: string, status: "active" | "paused" | "revoked"): Promise<{ kind: "ready"; status: NonNullable<QrDestinationStatusResponse["data"]> } | { kind: "error"; message: string }> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/qr-destinations/${encodeURIComponent(publicCode)}/status`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
  const body = (await response.json()) as QrDestinationStatusResponse;
  return body.data ? { kind: "ready", status: body.data } : { kind: "error", message: userFacingMessage(response.status, body.error, "We could not update that booking link.") };
}

export async function rotateQrDestination(fetcher: AdminFetchLike, baseUrl: string, tenantId: string, publicCode: string): Promise<{ kind: "ready"; destination: NonNullable<QrDestinationRotateResponse["data"]> } | { kind: "error"; message: string }> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/qr-destinations/${encodeURIComponent(publicCode)}/rotate`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  const body = (await response.json()) as QrDestinationRotateResponse;
  return body.data ? { kind: "ready", destination: body.data } : { kind: "error", message: userFacingMessage(response.status, body.error, "We could not replace that booking link.") };
}

export async function fetchQrDestinations(fetcher: AdminFetchLike, baseUrl: string, tenantId: string): Promise<QrAdminState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/qr-destinations`, { credentials: "include" });
  const body = (await response.json()) as QrDestinationListResponse;
  if (body.data) return { kind: "ready", destinations: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to booking links.") };
  return { kind: "error", message: userFacingMessage(response.status, body.error, "We could not load booking links.") };
}
