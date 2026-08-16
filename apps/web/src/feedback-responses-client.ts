// Ownership: staff feedback response reporting client with explicit operational states.

import type { FeedbackResponseSummary } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type FeedbackResponsesState = { kind: "ready"; responses: readonly FeedbackResponseSummary[] } | { kind: "denied" | "error"; message: string };

export async function fetchFeedbackResponses(fetcher: (url: string, init: { credentials: "include" }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>, baseUrl: string, tenantId: string, campaignId?: string): Promise<FeedbackResponsesState> {
  const query = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : "";
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/feedback-responses${query}`, { credentials: "include" });
  const body = (await response.json()) as { data: readonly FeedbackResponseSummary[] | null; error: { code: string; message: string } | null };
  if (body.data) return { kind: "ready", responses: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to feedback responses.") };
  return { kind: "error", message: userFacingMessage(response.status, body.error, "We could not load feedback responses.") };
}
