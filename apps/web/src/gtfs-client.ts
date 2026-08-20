// Ownership: typed tenant GTFS readiness client; no internal IDs are invented in the browser.

import type { GtfsPublicationCommand, GtfsPublicationCommandResponse, GtfsPublicationGenerationResponse, GtfsPublicationStatus, GtfsValidationReportResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

type Fetcher = (url: string, init: { credentials: "include"; method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; json(): Promise<unknown> }>;
export type GtfsPublicationState = { kind: "ready"; status: GtfsPublicationStatus } | { kind: "denied" | "error"; message: string };
export type GtfsValidationState = { kind: "ready"; report: NonNullable<GtfsValidationReportResponse["data"]> } | { kind: "denied" | "error"; message: string };

async function read(fetcher: Fetcher, url: string): Promise<{ status: number; body: { data?: unknown; error?: { code?: string; message?: string } | null } }> {
  const response = await fetcher(url, { credentials: "include" });
  return { status: response.status, body: (await response.json()) as { data?: unknown; error?: { code?: string; message?: string } | null } };
}
export type GtfsCommandState = { kind: "ready"; version: NonNullable<GtfsPublicationCommandResponse["data"]>["feedVersion"] } | { kind: "denied" | "error"; message: string };
export type GtfsGenerationState = { kind: "ready"; version: NonNullable<GtfsPublicationGenerationResponse["data"]>["feedVersion"] } | { kind: "denied" | "error"; message: string };

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

export async function executeGtfsCommand(fetcher: Fetcher, baseUrl: string, tenantId: string, command: GtfsPublicationCommand): Promise<GtfsCommandState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/gtfs/commands`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command) });
  const result = (await response.json()) as GtfsPublicationCommandResponse;
  if (result.data) return { kind: "ready", version: result.data.feedVersion };
  const denied = result.error?.code === "GTFS_ACCESS_DENIED" || result.error?.code === "UNAUTHENTICATED";
  return { kind: denied ? "denied" : "error", message: userFacingMessage(response.status, result.error, "That Schedule action could not be completed.") };
}

export async function generateGtfsArtifact(fetcher: Fetcher, baseUrl: string, tenantId: string, feedVersionId: string): Promise<GtfsGenerationState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/gtfs/versions/${encodeURIComponent(feedVersionId)}/generate`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" } });
  const result = (await response.json()) as GtfsPublicationGenerationResponse;
  if (result.error) { const denied = result.error.code === "GTFS_ACCESS_DENIED" || result.error.code === "UNAUTHENTICATED"; return { kind: denied ? "denied" : "error", message: userFacingMessage(response.status, result.error, "Schedule generation could not be completed.") }; }
  if (result.data) return { kind: "ready", version: result.data.feedVersion };
  return { kind: "error", message: userFacingMessage(response.status, result.error, "Schedule generation could not be completed.") };
}
