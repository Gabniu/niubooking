// Ownership: public mobile feedback client with explicit expired/used/error states.

import { feedbackPath, type PublicFeedbackResponse, type FeedbackSubmissionResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export type FeedbackState = { kind: "ready"; survey: NonNullable<PublicFeedbackResponse["data"]> } | { kind: "submitted" } | { kind: "unavailable"; message: string } | { kind: "error"; message: string };

export async function fetchFeedback(fetcher: (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>, baseUrl: string, capabilityId: string): Promise<FeedbackState> {
  const response = await fetcher(`${baseUrl}${feedbackPath(capabilityId)}`);
  const body = (await response.json()) as PublicFeedbackResponse;
  if (body.data) return { kind: "ready", survey: body.data };
  if (body.error?.code === "FEEDBACK_EXPIRED" || body.error?.code === "FEEDBACK_USED" || body.error?.code === "FEEDBACK_NOT_FOUND") return { kind: "unavailable", message: userFacingMessage(response.status, body.error, "This feedback link is not available.") };
  return { kind: "error", message: userFacingMessage(response.status, body.error, "We could not load this feedback form.") };
}

export async function submitFeedback(fetcher: (url: string, init: { method: "POST"; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>, baseUrl: string, capabilityId: string, answers: Readonly<Record<string, string | number>>): Promise<FeedbackState> {
  const response = await fetcher(`${baseUrl}${feedbackPath(capabilityId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers }) });
  const body = (await response.json()) as FeedbackSubmissionResponse;
  if (body.data?.submitted) return { kind: "submitted" };
  return { kind: "unavailable", message: userFacingMessage(response.status, body.error, "This feedback link is no longer available.") };
}
