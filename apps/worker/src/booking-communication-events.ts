// Ownership: booking lifecycle adapter. It translates authoritative events into outbox mutations.

import { enqueueCommunicationJob } from "@bookingapp/database";
import {
  planFeedbackJob,
  planOccurrenceReminderJobs,
  planReminderJobs,
  type BookingCommunicationContext,
  type CommunicationSettings,
  type FeedbackCampaign,
  type OccurrenceCommunicationContext,
} from "@bookingapp/domain";

export type BookingCommunicationEvent =
  | { type: "booking.created" | "booking.rescheduled"; booking: BookingCommunicationContext }
  | { type: "occurrence.reserved"; occurrence: OccurrenceCommunicationContext }
  | { type: "occurrence.reservation_status_changed"; tenantId: string; occurrenceId: string; reservationId: string; status: "held" | "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show" }
  | { type: "booking.cancelled"; tenantId: string; bookingId: string }
  | { type: "booking.completed" | "feedback.requested"; tenantId: string; customerId: string; campaign: FeedbackCampaign; optedOut: boolean; lastSentAt: Date | null; now: Date; channel: "email" | "sms" | "voice" };

export interface CommunicationEventDependencies {
  settings(tenantId: string): Promise<CommunicationSettings>;
  enqueue(job: Parameters<typeof enqueueCommunicationJob>[1]): Promise<void>;
  cancel(tenantId: string, bookingId: string): Promise<number>;
  cancelOccurrence?(tenantId: string, occurrenceId: string, reservationId: string): Promise<number>;
}

export async function handleBookingCommunicationEvent(event: BookingCommunicationEvent, dependencies: CommunicationEventDependencies): Promise<number> {
  if (event.type === "booking.cancelled") return dependencies.cancel(event.tenantId, event.bookingId);
  if (event.type === "occurrence.reservation_status_changed") {
    if (!["completed", "cancelled", "no_show"].includes(event.status) || !dependencies.cancelOccurrence) return 0;
    return dependencies.cancelOccurrence(event.tenantId, event.occurrenceId, event.reservationId);
  }
  if (event.type === "booking.completed" || event.type === "feedback.requested") {
    const job = planFeedbackJob(event.campaign, { customerId: event.customerId, hasCompletedAppointment: event.type === "booking.completed", optedOut: event.optedOut, lastSentAt: event.lastSentAt, now: event.now, channel: event.channel });
    if (!job) return 0;
    await dependencies.enqueue(job);
    return 1;
  }
  if (event.type === "occurrence.reserved") {
    const settings = await dependencies.settings(event.occurrence.tenantId);
    const jobs = planOccurrenceReminderJobs(settings, event.occurrence);
    for (const job of jobs) await dependencies.enqueue(job);
    return jobs.length;
  }
  if (!("booking" in event)) return 0;
  const settings = await dependencies.settings(event.booking.tenantId);
  if (event.type === "booking.rescheduled") await dependencies.cancel(event.booking.tenantId, event.booking.bookingId);
  const jobs = planReminderJobs(settings, event.booking);
  for (const job of jobs) await dependencies.enqueue(job);
  return jobs.length;
}
