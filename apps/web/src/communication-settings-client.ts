// Ownership: authenticated organization settings client for reminder and feedback controls.

import type { CommunicationSettings, CommunicationSettingsResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type CommunicationSettingsState = { kind: "ready"; settings: NonNullable<CommunicationSettingsResponse["data"]> } | { kind: "denied" | "error"; message: string };
export type CommunicationSettingsFetcher = (url: string, init: { credentials: "include"; method?: "PUT"; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export async function fetchCommunicationSettings(fetcher: CommunicationSettingsFetcher, baseUrl: string, tenantId: string): Promise<CommunicationSettingsState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/communication-settings`, { credentials: "include" });
  const body = (await response.json()) as CommunicationSettingsResponse;
  if (body.data) return { kind: "ready", settings: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to communication settings.") };
  return { kind: "error", message: userFacingMessage(response.status, body.error, "We could not load communication settings.") };
}

export async function saveCommunicationSettings(fetcher: CommunicationSettingsFetcher, baseUrl: string, tenantId: string, settings: Omit<CommunicationSettings, "tenantId">): Promise<CommunicationSettingsState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/communication-settings`, { credentials: "include", method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) });
  if (response.status === 204) return { kind: "ready", settings: { ...settings, tenantId } };
  const body = (await response.json()) as CommunicationSettingsResponse;
  if (body.data) return { kind: "ready", settings: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to communication settings.") };
  return { kind: "error", message: userFacingMessage(response.status, body.error, "We could not save communication settings.") };
}
