// Ownership: typed staff fleet reads; authorization and branch scope stay on the API.

import type { FleetStreamEvent, StaffLiveFleetResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type FleetStaffFetcher = (url: string, init: { credentials: "include" }) => Promise<{ status: number; json(): Promise<unknown> }>;
export type FleetState =
  | { kind: "loading" }
  | { kind: "ready"; value: NonNullable<StaffLiveFleetResponse["data"]> }
  | { kind: "denied" | "error"; message: string };
export interface FleetEventSource { addEventListener(type: "snapshot" | "changed", listener: (event: { data: string }) => void): void; close(): void; onerror?: ((event?: unknown) => void) | null; }
export type FleetEventSourceFactory = (url: string, init: { withCredentials: boolean }) => FleetEventSource;

export async function fetchFleetCurrent(fetcher: FleetStaffFetcher, baseUrl: string, tenantId: string): Promise<FleetState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/fleet/current`, { credentials: "include" });
  const body = (await response.json()) as StaffLiveFleetResponse;
  if (body.data) return { kind: "ready", value: body.data };
  const denied = body.error?.code === "FLEET_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED";
  return { kind: denied ? "denied" : "error", message: userFacingMessage(response.status, body.error, "Live fleet locations could not be loaded.") };
}

export function openFleetStream(factory: FleetEventSourceFactory, baseUrl: string, tenantId: string, onSnapshot: (value: NonNullable<StaffLiveFleetResponse["data"]>) => void, onChanged: () => void, onError: () => void): () => void {
  const source = factory(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/fleet/stream`, { withCredentials: true });
  const handle = (event: { data: string }) => { try { const value = JSON.parse(event.data) as FleetStreamEvent; if (value.response.data) onSnapshot(value.response.data); else onChanged(); } catch { onError(); } };
  source.addEventListener("snapshot", handle); source.addEventListener("changed", handle);
  source.onerror = onError;
  return () => source.close();
}
