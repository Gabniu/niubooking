// Ownership: typed tenant GTFS readiness client; no internal IDs are invented in the browser.

import type { GtfsPublicationStatus, GtfsValidationReportResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

type Fetcher = (url: string, init: { credentials: "include" }) => Promise<{ status: number; json(): Promise<unknown> }>;
export type GtfsPublicationState = { kind: "ready"; status: GtfsPublicationStatus } | { kind: "denied" | "error"; message: string };
export type GtfsValidationState = { kind: "ready"; report: NonNullable<GtfsValidationReportResponse["data"]> } | { kind: "denied" | "error"; message: string };

async function read(fetcher: Fetcher, url: string): Promise<{ status: number; body: { data?: unknown; error?: { code?: string; message?: string } | null } }> {
  const response = await fetcher(url, { credentials: "include" });
  return { status: response.status, body: (await response.json()) as { data?: unknown; error?: { code?: string; message?: string } | null } };
}

export async function fetchGtfsPublication(fetcher: Fetcher, baseUrl: string, tenantId: string): Promise<GtfsPublicationState> {
  const { status, body } = await read(fetcher, `${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/gtfs/publication`);
  if (body.data) return { kind: "ready", status: body.data as GtfsPublicationStatus };
  const denied = body.error?.code === "GTFS_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED";
  return { kind: denied ? "denied" : "error", message: userFacingMessage(status, body.error, "Transit publication status could not be loaded.") };
}

export async function fetchGtfsValidation(fetcher: Fetcher, baseUrl: string, tenantId: string, feedVersionId: string): Promise<GtfsValidationState> {
  const { status, body } = await read(fetcher, `${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/gtfs/versions/${encodeURIComponent(feedVersionId)}/validation`);
  if (body.data) return { kind: "ready", report: body.data as NonNullable<GtfsValidationReportResponse["data"]> };
  const denied = body.error?.code === "GTFS_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED";
  return { kind: denied ? "denied" : "error", message: userFacingMessage(status, body.error, "Schedule validation could not be loaded.") };
}
