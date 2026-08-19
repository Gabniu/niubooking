// Ownership: tenant-authorized transport operations client; identity and tenant admission stay in the shell.

import type { TransportBoardingResponse, TransportManifestResponse, TransportRouteResponse, TransportRoutesResponse, TransportSeatAssignmentResponse, TransportTripResponse, TransportTripsResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type TransportStaffFetcher = (url: string, init: { credentials: "include"; method?: "POST"; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; json(): Promise<unknown> }>;
type StaffState<T> = { kind: "ready"; value: T } | { kind: "denied" | "error"; message: string };

function failure(status: number, error: { code?: string; message?: string } | null | undefined, fallback: string): { kind: "denied" | "error"; message: string } {
  return { kind: error?.code === "TENANT_ACCESS_DENIED" ? "denied" : "error", message: userFacingMessage(status, error, fallback) };
}

function dateParams(from?: string, to?: string): string {
  const query = new URLSearchParams();
  if (from) { const value = new Date(from); if (!Number.isNaN(value.getTime())) query.set("from", value.toISOString()); }
  if (to) { const value = new Date(to); if (!Number.isNaN(value.getTime())) query.set("to", value.toISOString()); }
  const value = query.toString();
  return value ? `?${value}` : "";
}

export async function fetchTransportRoutes(fetcher: TransportStaffFetcher, baseUrl: string, tenantId: string): Promise<StaffState<NonNullable<TransportRoutesResponse["data"]>>> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/transport/routes`, { credentials: "include" });
  const body = (await response.json()) as TransportRoutesResponse;
  return body.data ? { kind: "ready", value: body.data } : failure(response.status, body.error, "Transport routes could not be loaded.");
}

export async function createTransportRoute(fetcher: TransportStaffFetcher, baseUrl: string, tenantId: string, input: { name: string; mode: "bus" | "matatu" | "shuttle" | "charter"; status: "draft" | "published" | "archived"; stops: readonly { stopId: string; sequence: number; boardingMinutes: number; alightingMinutes: number }[] }): Promise<StaffState<NonNullable<TransportRouteResponse["data"]>>> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/transport/routes`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  const body = (await response.json()) as TransportRouteResponse;
  return body.data ? { kind: "ready", value: body.data } : failure(response.status, body.error, "Transport route could not be created.");
}

export async function fetchTransportTrips(fetcher: TransportStaffFetcher, baseUrl: string, tenantId: string, from?: string, to?: string): Promise<StaffState<NonNullable<TransportTripsResponse["data"]>>> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/transport/trips${dateParams(from, to)}`, { credentials: "include" });
  const body = (await response.json()) as TransportTripsResponse;
  return body.data ? { kind: "ready", value: body.data } : failure(response.status, body.error, "Transport trips could not be loaded.");
}

export async function createTransportTrip(fetcher: TransportStaffFetcher, baseUrl: string, tenantId: string, input: { routeId: string; routeVersion: number; occurrenceId: string; capacityMode: "seat" | "open"; capacity: number; boardingStartsAt: string; boardingEndsAt: string; vehicleResourceId?: string | null }): Promise<StaffState<NonNullable<TransportTripResponse["data"]>>> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/transport/trips`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  const body = (await response.json()) as TransportTripResponse;
  return body.data ? { kind: "ready", value: body.data } : failure(response.status, body.error, "Transport trip could not be created.");
}

export async function fetchTransportManifest(fetcher: TransportStaffFetcher, baseUrl: string, tenantId: string, tripId: string): Promise<StaffState<NonNullable<TransportManifestResponse["data"]>>> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/transport/trips/${encodeURIComponent(tripId)}/manifest`, { credentials: "include" });
  const body = (await response.json()) as TransportManifestResponse;
  return body.data ? { kind: "ready", value: body.data } : failure(response.status, body.error, "The trip manifest could not be loaded.");
}

export async function boardTransportTicket(fetcher: TransportStaffFetcher, baseUrl: string, tenantId: string, tripId: string, ticketId: string, idempotencyKey: string): Promise<StaffState<NonNullable<TransportBoardingResponse["data"]>>> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/transport/trips/${encodeURIComponent(tripId)}/tickets/${encodeURIComponent(ticketId)}/board`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey }) });
  const body = (await response.json()) as TransportBoardingResponse;
  return body.data ? { kind: "ready", value: body.data } : failure(response.status, body.error, "That passenger could not be boarded.");
}

export async function assignTransportReservationSeats(fetcher: TransportStaffFetcher, baseUrl: string, tenantId: string, tripId: string, reservationId: string, seatLabels: readonly string[]): Promise<StaffState<NonNullable<TransportSeatAssignmentResponse["data"]>>> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/transport/trips/${encodeURIComponent(tripId)}/reservations/${encodeURIComponent(reservationId)}/seats`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seatLabels }) });
  const body = (await response.json()) as TransportSeatAssignmentResponse;
  return body.data ? { kind: "ready", value: body.data } : failure(response.status, body.error, "Seats could not be assigned.");
}
