// Ownership: deterministic worker job policy. Delivery is retried safely through idempotency keys.

import type { CommunicationChannel } from "./communications.js";

export type CommunicationJobKind = "reminder" | "feedback" | "verification";
export type CommunicationJobStatus = "pending" | "claimed" | "sent" | "failed" | "suppressed" | "cancelled";

export interface CommunicationJob {
  id: string;
  tenantId: string;
  kind: CommunicationJobKind;
  channel: CommunicationChannel;
  idempotencyKey: string;
  scheduledFor: Date;
  status: CommunicationJobStatus;
  bookingId: string | null;
  occurrenceId?: string | null;
  reservationId?: string | null;
  customerId: string;
  campaignId?: string | null;
  templateVersion?: number | null;
  feedbackExpiresAt?: Date | null;
  feedbackUrl?: string;
  /** Resolved only in worker memory; never persisted in communication_outbox. */
  recipient?: string;
  /** Verification delivery fields are ephemeral and never persisted. */
  verificationChallengeId?: string;
  verificationCode?: string;
  verificationUrl?: string;
}

/** Persisted/enqueued shape. Delivery-only fields are deliberately excluded. */
export type CommunicationJobDraft = Omit<CommunicationJob, "status" | "recipient" | "feedbackUrl" | "verificationChallengeId" | "verificationCode" | "verificationUrl">;

export function communicationIdempotencyKey(input: { tenantId: string; kind: CommunicationJobKind; customerId: string; campaignOrRuleId: string; occurrence: string }): string {
  return [input.tenantId, input.kind, input.customerId, input.campaignOrRuleId, input.occurrence].join(":");
}

export function shouldSuppressJob(input: { optedOut: boolean; bookingCancelled: boolean; contactAvailable: boolean; now: Date; scheduledFor: Date }): boolean {
  return input.optedOut || input.bookingCancelled || !input.contactAvailable || input.scheduledFor.getTime() < input.now.getTime();
}
