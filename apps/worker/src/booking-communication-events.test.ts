import assert from "node:assert/strict";
import test from "node:test";
import { handleBookingCommunicationEvent } from "./booking-communication-events.js";

const settings = { tenantId: "tenant-1", timezone: "UTC", remindersEnabled: true, feedbackEnabled: true, defaultFeedbackFrequencyDays: 30, bookingChangePolicy: { rescheduleEnabled: true, cancellationEnabled: true, minimumNoticeMinutes: 0 }, reminderRules: [{ id: "rule-1", enabled: true, minutesBefore: 60, channels: ["sms"] as const, quietHoursStart: null, quietHoursEnd: null, frequencyCapHours: 24 }] };
const booking = { tenantId: "tenant-1", bookingId: "booking-1", customerId: "customer-1", appointmentStart: new Date("2026-08-12T12:00:00Z"), occurrence: "booking-1-v2", contactChannels: ["sms"] as const };

test("enqueues reminders for created and rescheduled bookings", async () => {
  const queued: unknown[] = [];
  let cancelled = 0;
  const dependencies = { settings: async () => settings, enqueue: async (job: unknown) => { queued.push(job); }, cancel: async () => { cancelled += 1; return 1; } };
  assert.equal(await handleBookingCommunicationEvent({ type: "booking.created", booking }, dependencies), 1);
  assert.equal(await handleBookingCommunicationEvent({ type: "booking.rescheduled", booking }, dependencies), 1);
  assert.equal(queued.length, 2);
  assert.equal(cancelled, 1);
});

test("creates post-appointment feedback through the completed event", async () => {
  const queued: unknown[] = [];
  const dependencies = { settings: async () => settings, enqueue: async (job: unknown) => { queued.push(job); }, cancel: async () => 0 };
  const count = await handleBookingCommunicationEvent({ type: "booking.completed", tenantId: "tenant-1", customerId: "customer-1", campaign: { id: "campaign-1", tenantId: "tenant-1", enabled: true, audience: "completed-appointment", templateVersion: 1, frequencyCapDays: 7, expiresAfterDays: 14 }, optedOut: false, lastSentAt: null, now: new Date("2026-08-12"), channel: "email" }, dependencies);
  assert.equal(count, 1);
  assert.equal(queued.length, 1);
});

test("creates general feedback for a client without an appointment", async () => {
  const queued: unknown[] = [];
  const dependencies = { settings: async () => settings, enqueue: async (job: unknown) => { queued.push(job); }, cancel: async () => 0 };
  const count = await handleBookingCommunicationEvent({ type: "feedback.requested", tenantId: "tenant-1", customerId: "customer-2", campaign: { id: "campaign-2", tenantId: "tenant-1", enabled: true, audience: "any-client", templateVersion: 2, frequencyCapDays: 30, expiresAfterDays: 14 }, optedOut: false, lastSentAt: null, now: new Date("2026-08-12"), channel: "sms" }, dependencies);
  assert.equal(count, 1);
  assert.equal(queued.length, 1);
  assert.equal((queued[0] as { bookingId: string | null }).bookingId, null);
});

test("does not enqueue general feedback for opted-out clients", async () => {
  let enqueued = 0;
  const dependencies = { settings: async () => settings, enqueue: async () => { enqueued += 1; }, cancel: async () => 0 };
  const count = await handleBookingCommunicationEvent({ type: "feedback.requested", tenantId: "tenant-1", customerId: "customer-3", campaign: { id: "campaign-3", tenantId: "tenant-1", enabled: true, audience: "any-client", templateVersion: 1, frequencyCapDays: 30, expiresAfterDays: 14 }, optedOut: true, lastSentAt: null, now: new Date("2026-08-12"), channel: "email" }, dependencies);
  assert.equal(count, 0);
  assert.equal(enqueued, 0);
});

test("enqueues occurrence reminders with reservation subjects", async () => {
  const queued: unknown[] = [];
  const dependencies = { settings: async () => settings, enqueue: async (job: unknown) => { queued.push(job); }, cancel: async () => 0 };
  const count = await handleBookingCommunicationEvent({ type: "occurrence.reserved", occurrence: { tenantId: "tenant-1", occurrenceId: "occ-1", reservationId: "reservation-1", customerId: "customer-1", occurrenceStart: new Date("2030-08-12T12:00:00Z"), contactChannels: ["sms"] } }, dependencies);
  assert.equal(count, 1);
  assert.equal((queued[0] as { bookingId: string | null; occurrenceId: string; reservationId: string }).bookingId, null);
  assert.equal((queued[0] as { occurrenceId: string }).occurrenceId, "occ-1");
});

test("cancels only pending reminders for a completed occurrence reservation", async () => {
  let cancelled = "";
  const dependencies = { settings: async () => settings, enqueue: async () => {}, cancel: async () => 0, cancelOccurrence: async (tenantId: string, occurrenceId: string, reservationId: string) => { cancelled = `${tenantId}:${occurrenceId}:${reservationId}`; return 2; } };
  const count = await handleBookingCommunicationEvent({ type: "occurrence.reservation_status_changed", tenantId: "tenant-1", occurrenceId: "occ-1", reservationId: "reservation-1", status: "cancelled" }, dependencies);
  assert.equal(count, 2);
  assert.equal(cancelled, "tenant-1:occ-1:reservation-1");
});
