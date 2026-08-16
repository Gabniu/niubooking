// Ownership: typed occurrence client; it never invents availability or capacity.

import type { OccurrenceResponse, OccurrencesResponse, ReservationStatusResponse, ReservationsResponse, OccurrenceSummary, ReservationSummary } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type OccurrenceFetcher = (url: string, init: { credentials: "include"; method?: "POST"; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; json(): Promise<unknown> }>;
export type OccurrencesState = { kind: "ready"; occurrences: readonly OccurrenceSummary[] } | { kind: "denied" | "error"; message: string };
function map(status: number, body: OccurrencesResponse): OccurrencesState { if (body.data) return { kind: "ready", occurrences: body.data }; if (body.error?.code === "TENANT_ACCESS_DENIED") return { kind: "denied", message: userFacingMessage(status, body.error, "You do not have access to sessions.") }; return { kind: "error", message: userFacingMessage(status, body.error, "We could not load sessions.") }; }
export async function fetchOccurrences(fetcher: OccurrenceFetcher, baseUrl: string, tenantId: string): Promise<OccurrencesState> { const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/occurrences`, { credentials: "include" }); return map(response.status, (await response.json()) as OccurrencesResponse); }
export async function createOccurrence(fetcher: OccurrenceFetcher, baseUrl: string, tenantId: string, input: { serviceId: string; label: string; startsAt: string; endsAt: string; capacity: number | null }): Promise<{ kind: "ready"; occurrence: NonNullable<OccurrenceResponse["data"]> } | { kind: "error"; message: string }> { const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/occurrences`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }); const body = (await response.json()) as OccurrenceResponse; return body.data ? { kind: "ready", occurrence: body.data } : { kind: "error", message: userFacingMessage(response.status, body.error, "We could not create that session.") }; }

export async function fetchReservations(fetcher: OccurrenceFetcher, baseUrl: string, tenantId: string, occurrenceId: string): Promise<{ kind: "ready"; reservations: readonly ReservationSummary[] } | { kind: "error"; message: string }> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/occurrences/${encodeURIComponent(occurrenceId)}/reservations`, { credentials: "include" });
  const body = (await response.json()) as ReservationsResponse;
  return body.data ? { kind: "ready", reservations: body.data } : { kind: "error", message: userFacingMessage(response.status, body.error, "We could not load reservations.") };
}

export async function updateReservationStatus(fetcher: OccurrenceFetcher, baseUrl: string, tenantId: string, occurrenceId: string, reservationId: string, status: ReservationSummary["status"]): Promise<{ kind: "ready"; reservation: NonNullable<ReservationStatusResponse["data"]> } | { kind: "error"; message: string }> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/occurrences/${encodeURIComponent(occurrenceId)}/reservations/${encodeURIComponent(reservationId)}/status`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
  const body = (await response.json()) as ReservationStatusResponse;
  return body.data ? { kind: "ready", reservation: body.data } : { kind: "error", message: userFacingMessage(response.status, body.error, "We could not update that reservation.") };
}
