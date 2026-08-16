// Ownership: typed tenant booking client. It maps API failures without fabricating schedule data.

import type { BookingResponse, BookingsResponse, BookingSummary } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type BookingFetcher = (url: string, init: { credentials: "include"; method?: "POST"; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; json(): Promise<unknown> }>;
export type BookingsState = { kind: "ready"; bookings: readonly BookingSummary[] } | { kind: "denied" | "error"; message: string };
export type BookingState = { kind: "ready"; booking: BookingSummary } | { kind: "denied" | "error"; message: string };

function message(status: number, error?: { code?: string; message?: string }): string { return userFacingMessage(status, error, "We could not load appointments."); }
export async function fetchBookings(fetcher: BookingFetcher, baseUrl: string, tenantId: string, from?: string, to?: string): Promise<BookingsState> {
  const query = from || to ? `?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) })}` : "";
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/bookings${query}`, { credentials: "include" });
  const body = (await response.json()) as BookingsResponse;
  if (body.data) return { kind: "ready", bookings: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to appointments.") };
  return { kind: "error", message: message(response.status, body.error ?? undefined) };
}

export async function createBooking(fetcher: BookingFetcher, baseUrl: string, tenantId: string, input: { customerId: string; serviceName: string; startsAt: string; endsAt: string; resourceIds?: readonly string[] }): Promise<BookingState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/bookings`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  const body = (await response.json()) as BookingResponse;
  if (body.data) return { kind: "ready", booking: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to appointments.") };
  return { kind: "error", message: message(response.status, body.error ?? undefined) };
}

export async function setBookingStatus(fetcher: BookingFetcher, baseUrl: string, tenantId: string, bookingId: string, status: "scheduled" | "cancelled" | "completed"): Promise<BookingState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/bookings/${encodeURIComponent(bookingId)}/status`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
  const body = (await response.json()) as BookingResponse;
  if (body.data) return { kind: "ready", booking: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to appointments.") };
  return { kind: "error", message: message(response.status, body.error ?? undefined) };
}
