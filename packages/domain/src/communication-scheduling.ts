// Ownership: event-to-job planning. Replayed booking events produce the same idempotency keys.

import { communicationIdempotencyKey, type CommunicationJobDraft } from "./communication-jobs.js";
import { isFeedbackEligible, reminderAt, type CommunicationSettings, type FeedbackCampaign } from "./communications.js";

export interface BookingCommunicationContext {
  tenantId: string;
  bookingId: string;
  customerId: string;
  appointmentStart: Date;
  occurrence: string;
  contactChannels: readonly ("email" | "sms" | "voice")[];
}

export interface OccurrenceCommunicationContext {
  tenantId: string;
  occurrenceId: string;
  reservationId: string;
  customerId: string;
  occurrenceStart: Date;
  contactChannels: readonly ("email" | "sms" | "voice")[];
}

export function planReminderJobs(settings: CommunicationSettings, booking: BookingCommunicationContext): readonly CommunicationJobDraft[] {
  if (!settings.remindersEnabled) return [];
  const jobs: CommunicationJobDraft[] = [];
  for (const rule of settings.reminderRules) {
    if (!rule.enabled) continue;
    const scheduledFor = reminderAt(booking.appointmentStart, rule);
    for (const channel of rule.channels) {
      if (!booking.contactChannels.includes(channel)) continue;
      const idempotencyKey = communicationIdempotencyKey({ tenantId: booking.tenantId, kind: "reminder", customerId: booking.customerId, campaignOrRuleId: rule.id, occurrence: booking.occurrence });
      jobs.push({ id: idempotencyKey, tenantId: booking.tenantId, kind: "reminder", channel, idempotencyKey, scheduledFor, bookingId: booking.bookingId, customerId: booking.customerId, campaignId: null, templateVersion: null, feedbackExpiresAt: null });
    }
  }
  return jobs;
}

export function planOccurrenceReminderJobs(settings: CommunicationSettings, occurrence: OccurrenceCommunicationContext): readonly CommunicationJobDraft[] {
  if (!settings.remindersEnabled) return [];
  const jobs: CommunicationJobDraft[] = [];
  for (const rule of settings.reminderRules) {
    if (!rule.enabled) continue;
    const scheduledFor = reminderAt(occurrence.occurrenceStart, rule);
    for (const channel of rule.channels) {
      if (!occurrence.contactChannels.includes(channel)) continue;
      const idempotencyKey = communicationIdempotencyKey({ tenantId: occurrence.tenantId, kind: "reminder", customerId: occurrence.customerId, campaignOrRuleId: rule.id, occurrence: `${occurrence.occurrenceId}:${occurrence.reservationId}` });
      jobs.push({ id: idempotencyKey, tenantId: occurrence.tenantId, kind: "reminder", channel, idempotencyKey, scheduledFor, bookingId: null, occurrenceId: occurrence.occurrenceId, reservationId: occurrence.reservationId, customerId: occurrence.customerId, campaignId: null, templateVersion: null, feedbackExpiresAt: null });
    }
  }
  return jobs;
}

export function planFeedbackJob(campaign: FeedbackCampaign, input: { customerId: string; hasCompletedAppointment: boolean; optedOut: boolean; lastSentAt: Date | null; now: Date; channel: "email" | "sms" | "voice" }): CommunicationJobDraft | null {
  if (!isFeedbackEligible({ campaign, hasCompletedAppointment: input.hasCompletedAppointment, optedOut: input.optedOut, lastSentAt: input.lastSentAt, now: input.now })) return null;
  const idempotencyKey = communicationIdempotencyKey({ tenantId: campaign.tenantId, kind: "feedback", customerId: input.customerId, campaignOrRuleId: campaign.id, occurrence: `v${campaign.templateVersion}` });
  return { id: idempotencyKey, tenantId: campaign.tenantId, kind: "feedback", channel: input.channel, idempotencyKey, scheduledFor: input.now, bookingId: null, customerId: input.customerId, campaignId: campaign.id, templateVersion: campaign.templateVersion, feedbackExpiresAt: new Date(input.now.getTime() + campaign.expiresAfterDays * 86_400_000) };
}
