// Ownership: public feedback response contract. Capability IDs are opaque and single-purpose.

export type FeedbackPresentation = "compact" | "steps" | "conversation";
export type FeedbackAudience = "any-client" | "completed-appointment" | "campaign";

export interface FeedbackCampaignDraft {
  id: string;
  enabled: boolean;
  audience: FeedbackAudience;
  templateVersion: number;
  frequencyCapDays: number;
  expiresAfterDays: number;
}

export interface FeedbackCampaignResponse {
  data: FeedbackCampaignDraft & { tenantId: string } | null;
  error: { code: "UNAUTHENTICATED" | "TENANT_ACCESS_DENIED" | "FEEDBACK_ADMIN_UNAVAILABLE" | "FEEDBACK_INVALID"; message: string } | null;
}

export interface PublicFeedbackResponse {
  data: { capabilityId: string; campaignId: string; title: string; intro: string; templateVersion: number; presentation: FeedbackPresentation; questionsPerStep: number | null; questions: readonly { id: string; type: "rating" | "text" | "choice"; prompt: string; required: boolean; choices: readonly string[] }[] } | null;
  error: { code: "FEEDBACK_NOT_FOUND" | "FEEDBACK_EXPIRED" | "FEEDBACK_USED" | "FEEDBACK_INVALID"; message: string } | null;
}

export interface FeedbackSubmissionResponse {
  data: { submitted: true } | null;
  error: { code: "FEEDBACK_NOT_FOUND" | "FEEDBACK_EXPIRED" | "FEEDBACK_USED" | "FEEDBACK_INVALID"; message: string } | null;
}

export interface FeedbackTemplateDraft {
  campaignId: string;
  version: number;
  title: string;
  intro: string;
  presentation?: FeedbackPresentation;
  questionsPerStep?: number | null;
  questions: readonly { id: string; type: "rating" | "text" | "choice"; prompt: string; required: boolean; choices: readonly string[] }[];
}

export interface FeedbackTemplateResponse {
  data: FeedbackTemplateDraft | null;
  error: { code: "UNAUTHENTICATED" | "TENANT_ACCESS_DENIED" | "FEEDBACK_ADMIN_UNAVAILABLE" | "FEEDBACK_INVALID"; message: string } | null;
}

export interface FeedbackResponseSummary {
  capabilityId: string;
  campaignId: string;
  templateVersion: number;
  customerId: string;
  answers: Readonly<Record<string, string | number>>;
  submittedAt: string;
}

export interface FeedbackAnalyticsResponse {
  data: { campaignId: string; templateVersion: number; responseCount: number; averageRating: number | null; ratingCount: number; choiceCounts: Readonly<Record<string, Readonly<Record<string, number>>>> } | null;
  error: { code: "UNAUTHENTICATED" | "TENANT_ACCESS_DENIED" | "FEEDBACK_REPORTING_UNAVAILABLE"; message: string } | null;
}

export function feedbackPath(capabilityId: string): string { return `/v1/public/feedback/${encodeURIComponent(capabilityId)}`; }
