// Ownership: public transport journey client; only opaque QR and manage tokens cross the browser boundary.

import type { PublicTransportCancellationResponse, PublicTransportReservationResponse, PublicTransportTicketResponse, PublicTransportTripsResponse, RiderLiveStreamEvent, RiderLiveTripResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type TransportFetcher = (url: string, init?: { method?: "POST" | "GET"; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
export type TransportState<T> = { kind: "ready"; value: T } | { kind: "unavailable" | "error"; message: string };
export interface PublicTransportEventSource { addEventListener(type: "snapshot" | "changed", listener: (event: { data: string }) => void): void; close(): void; onerror?: ((event?: unknown) => void) | null; }
export type PublicTransportEventSourceFactory = (url: string, init: { withCredentials: boolean }) => PublicTransportEventSource;

function message(status: number, error: { code?: string; message?: string } | null | undefined, fallback: string): string {
  return userFacingMessage(status, error, fallback);
}

function dateQuery(date: string): string {
  const from = new Date(`${date}T00:00:00`);
  const to = new Date(`${date}T23:59:59.999`);
  return Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) ? "" : `?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
}

export async function fetchPublicTransportTrips(fetcher: TransportFetcher, baseUrl: string, publicCode: string, date?: string): Promise<TransportState<NonNullable<PublicTransportTripsResponse["data"]>>> {
  try {
    const query = date ? dateQuery(date) : "";
    const response = await fetcher(`${baseUrl}/v1/public/qr/${encodeURIComponent(publicCode)}/transport/trips${query}`);
    const body = (await response.json()) as PublicTransportTripsResponse;
    if (body.data) return { kind: "ready", value: body.data };
    return { kind: response.status === 404 || response.status === 410 ? "unavailable" : "error", message: message(response.status, body.error, "Trips are temporarily unavailable. Please try again.") };
  } catch {
    return { kind: "error", message: "We could not load trips. Check your connection and try again." };
  }
}

export async function createPublicTransportReservation(fetcher: TransportFetcher, baseUrl: string, publicCode: string, tripId: string, input: { customerName: string; originStopId: string; destinationStopId: string; quantity: number; idempotencyKey: string; contact?: { channel: "email" | "sms" | "voice"; destination: string; consentGranted: true } }): Promise<TransportState<NonNullable<PublicTransportReservationResponse["data"]>>> {
  try {
    const response = await fetcher(`${baseUrl}/v1/public/qr/${encodeURIComponent(publicCode)}/transport/trips/${encodeURIComponent(tripId)}/reservations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const body = (await response.json()) as PublicTransportReservationResponse;
    if (body.data) return { kind: "ready", value: body.data };
    return { kind: response.status === 404 || response.status === 410 ? "unavailable" : "error", message: message(response.status, body.error, "We could not reserve that trip. Please try again.") };
  } catch {
    return { kind: "error", message: "We could not reserve that trip. Check your connection and try again." };
  }
}

export async function cancelPublicTransportReservation(fetcher: TransportFetcher, baseUrl: string, manageToken: string, idempotencyKey: string): Promise<TransportState<NonNullable<PublicTransportCancellationResponse["data"]>>> {
  try {
    const response = await fetcher(`${baseUrl}/v1/public/transport/reservations/${encodeURIComponent(manageToken)}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey }) });
    const body = (await response.json()) as PublicTransportCancellationResponse;
    if (body.data) return { kind: "ready", value: body.data };
    return { kind: response.status === 404 ? "unavailable" : "error", message: message(response.status, body.error, "We could not cancel this reservation. Please try again.") };
  } catch {
    return { kind: "error", message: "We could not cancel this reservation. Check your connection and try again." };
  }
}

export async function fetchPublicTransportTicket(fetcher: TransportFetcher, baseUrl: string, token: string): Promise<TransportState<NonNullable<PublicTransportTicketResponse["data"]>>> {
  try {
    const response = await fetcher(`${baseUrl}/v1/public/transport/tickets/${encodeURIComponent(token)}`);
    const body = (await response.json()) as PublicTransportTicketResponse;
    if (body.data) return { kind: "ready", value: body.data };
    return { kind: response.status === 404 ? "unavailable" : "error", message: message(response.status, body.error, "This ticket link is not available.") };
  } catch {
    return { kind: "error", message: "We could not load this ticket. Check your connection and try again." };
  }
}

export async function fetchPublicLiveTrip(fetcher: TransportFetcher, baseUrl: string, token: string): Promise<TransportState<NonNullable<RiderLiveTripResponse["data"]>>> {
  try { const response = await fetcher(`${baseUrl}/v1/public/transport/tickets/${encodeURIComponent(token)}/live`); const body = (await response.json()) as RiderLiveTripResponse; if (body.data) return { kind: "ready", value: body.data }; return { kind: response.status === 404 || response.status === 410 ? "unavailable" : "error", message: message(response.status, body.error, "Live trip location is temporarily unavailable. Please try again.") }; } catch { return { kind: "error", message: "We could not load the live trip. Check your connection and try again." }; }
}

export function openPublicLiveStream(factory: PublicTransportEventSourceFactory, baseUrl: string, token: string, onSnapshot: (value: NonNullable<RiderLiveTripResponse["data"]>) => void, onChanged: () => void, onError: () => void): () => void {
  const source = factory(`${baseUrl}/v1/public/transport/tickets/${encodeURIComponent(token)}/live/stream`, { withCredentials: true });
  const handle = (event: { data: string }) => { try { const value = JSON.parse(event.data) as RiderLiveStreamEvent; if (value.response.data) onSnapshot(value.response.data); else onChanged(); } catch { onError(); } };
  source.addEventListener("snapshot", handle); source.addEventListener("changed", handle); source.onerror = onError; return () => source.close();
}
