// Ownership: staff feedback campaign client; no campaign data is fabricated in the UI.

import type { FeedbackCampaignDraft, FeedbackCampaignResponse, FeedbackCampaignSummary } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type FeedbackAdminState = { kind: "ready"; campaigns: readonly FeedbackCampaignSummary[] } | { kind: "denied" | "error"; message: string };

export async function fetchFeedbackCampaigns(fetcher: (url: string, init: { credentials: "include" }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>, baseUrl: string, tenantId: string): Promise<FeedbackAdminState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/feedback-campaigns`, { credentials: "include" });
  const body = (await response.json()) as { data: readonly FeedbackCampaignSummary[] | null; error: { code: string; message: string } | null };
  if (body.data) return { kind: "ready", campaigns: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to feedback campaigns.") };
  return { kind: "error", message: userFacingMessage(response.status, body.error, "We could not load feedback campaigns.") };
}

export interface FeedbackCampaignFetcher { (url: string, init: { credentials: "include"; method: "POST"; headers: Record<string, string>; body: string }): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>; }
export type FeedbackCampaignMutationState = { kind: "ready"; campaign: FeedbackCampaignDraft & { tenantId: string } } | { kind: "denied" | "error"; message: string };

export async function createFeedbackCampaign(fetcher: FeedbackCampaignFetcher, baseUrl: string, tenantId: string, draft: FeedbackCampaignDraft): Promise<FeedbackCampaignMutationState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/feedback-campaigns`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
  const body = (await response.json()) as FeedbackCampaignResponse;
  if (body.data) return { kind: "ready", campaign: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to feedback campaigns.") };
  return { kind: "error", message: userFacingMessage(response.status, body.error, "We could not save that feedback campaign.") };
}

export async function setFeedbackCampaignStatus(fetcher: FeedbackCampaignFetcher, baseUrl: string, tenantId: string, campaignId: string, enabled: boolean): Promise<{ kind: "ready"; enabled: boolean } | { kind: "denied" | "error"; message: string }> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/feedback-campaigns/${encodeURIComponent(campaignId)}/status`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled }) });
  const body = (await response.json()) as { data: { enabled: boolean } | null; error: { code: string; message: string } | null };
  if (body.data) return { kind: "ready", enabled: body.data.enabled };
  if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to feedback campaigns.") };
  return { kind: "error", message: userFacingMessage(response.status, body.error, "We could not update that campaign.") };
}
