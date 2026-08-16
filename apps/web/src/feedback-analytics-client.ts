// Ownership: aggregate-only feedback analytics client; no individual answers are rendered here.

import type { FeedbackAnalyticsResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type FeedbackAnalyticsState = { kind: "ready"; analytics: NonNullable<FeedbackAnalyticsResponse["data"]> } | { kind: "denied" | "error"; message: string };

export async function fetchFeedbackAnalytics(fetcher: (url: string, init: { credentials: "include" }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>, baseUrl: string, tenantId: string, campaignId: string, templateVersion?: number): Promise<FeedbackAnalyticsState> {
  const version = templateVersion ? `?templateVersion=${templateVersion}` : "";
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/feedback-campaigns/${encodeURIComponent(campaignId)}/analytics${version}`, { credentials: "include" });
  const body = (await response.json()) as FeedbackAnalyticsResponse;
  if (body.data) return { kind: "ready", analytics: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to feedback insights.") };
  return { kind: "error", message: userFacingMessage(response.status, body.error, "We could not load feedback insights.") };
}
