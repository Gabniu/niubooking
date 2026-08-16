// Ownership: authenticated feedback template-version client; it never activates a campaign implicitly.

import type { FeedbackTemplateDraft, FeedbackTemplateResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export interface FeedbackTemplateFetcher { (url: string, init: { credentials: "include"; method: "POST"; headers: Record<string, string>; body: string }): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>; }
export type FeedbackTemplateState = { kind: "ready"; template: FeedbackTemplateDraft } | { kind: "denied" | "error"; message: string };

export async function createFeedbackTemplate(fetcher: FeedbackTemplateFetcher, baseUrl: string, tenantId: string, draft: FeedbackTemplateDraft): Promise<FeedbackTemplateState> {
  const response = await fetcher(`${baseUrl}/v1/tenants/${encodeURIComponent(tenantId)}/feedback-templates`, { credentials: "include", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
  const body = (await response.json()) as FeedbackTemplateResponse;
  if (body.data) return { kind: "ready", template: body.data };
  if (body.error?.code === "TENANT_ACCESS_DENIED" || body.error?.code === "UNAUTHENTICATED") return { kind: "denied", message: userFacingMessage(response.status, body.error, "You do not have access to feedback templates.") };
  return { kind: "error", message: userFacingMessage(response.status, body.error, "We could not save that feedback template.") };
}
