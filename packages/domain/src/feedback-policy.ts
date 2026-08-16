// Ownership: organization feedback configuration validation. Invalid campaigns never enter delivery.

import type { FeedbackAudience, FeedbackCampaign } from "./communications.js";

export interface FeedbackCampaignDraft {
  id: string;
  tenantId: string;
  enabled: boolean;
  audience: FeedbackAudience;
  templateVersion: number;
  frequencyCapDays: number;
  expiresAfterDays: number;
}

export function validateFeedbackCampaign(draft: FeedbackCampaignDraft): readonly string[] {
  const errors: string[] = [];
  if (!draft.id || !draft.tenantId) errors.push("Campaign identity is required");
  if (draft.templateVersion < 1 || !Number.isInteger(draft.templateVersion)) errors.push("Template version must be a positive integer");
  if (draft.frequencyCapDays < 1 || !Number.isInteger(draft.frequencyCapDays)) errors.push("Frequency cap must be a positive integer");
  if (draft.expiresAfterDays < 1 || !Number.isInteger(draft.expiresAfterDays)) errors.push("Expiry must be a positive integer");
  if (draft.audience === "completed-appointment" && draft.expiresAfterDays > 90) errors.push("Post-appointment feedback must expire within 90 days");
  return errors;
}

export function campaignFromDraft(draft: FeedbackCampaignDraft): FeedbackCampaign {
  const errors = validateFeedbackCampaign(draft);
  if (errors.length) throw new Error(errors.join("; "));
  return { ...draft };
}
