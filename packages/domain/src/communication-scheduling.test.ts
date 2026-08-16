import assert from "node:assert/strict";
import test from "node:test";
import { planFeedbackJob, planOccurrenceReminderJobs, planReminderJobs } from "./communication-scheduling.js";

const settings = { tenantId: "tenant-1", timezone: "UTC", remindersEnabled: true, feedbackEnabled: true, defaultFeedbackFrequencyDays: 30, bookingChangePolicy: { rescheduleEnabled: true, cancellationEnabled: true, minimumNoticeMinutes: 0 }, reminderRules: [{ id: "rule-1", enabled: true, minutesBefore: 120, channels: ["sms", "email"] as const, quietHoursStart: null, quietHoursEnd: null, frequencyCapHours: 24 }] };
const booking = { tenantId: "tenant-1", bookingId: "booking-1", customerId: "customer-1", appointmentStart: new Date("2026-08-12T12:00:00Z"), occurrence: "booking-1-v1", contactChannels: ["sms"] as const };

test("plans only enabled, contactable reminder channels", () => {
  const jobs = planReminderJobs(settings, booking);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.scheduledFor.toISOString(), "2026-08-12T10:00:00.000Z");
});

test("plans general feedback without an appointment and rejects opt-out", () => {
  const campaign = { id: "campaign-1", tenantId: "tenant-1", enabled: true, audience: "any-client" as const, templateVersion: 2, frequencyCapDays: 7, expiresAfterDays: 14 };
  assert.equal(planFeedbackJob(campaign, { customerId: "customer-1", hasCompletedAppointment: false, optedOut: false, lastSentAt: null, now: new Date("2026-08-12"), channel: "email" })?.bookingId, null);
  assert.equal(planFeedbackJob(campaign, { customerId: "customer-1", hasCompletedAppointment: false, optedOut: true, lastSentAt: null, now: new Date("2026-08-12"), channel: "email" }), null);
});

test("plans occurrence reminders with reservation identity and no booking identity", () => {
  const jobs = planOccurrenceReminderJobs(settings, { tenantId: "tenant-1", occurrenceId: "occ-1", reservationId: "reservation-1", customerId: "customer-1", occurrenceStart: new Date("2026-08-12T12:00:00Z"), contactChannels: ["sms"] });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.bookingId, null);
  assert.equal(jobs[0]?.occurrenceId, "occ-1");
  assert.equal(jobs[0]?.reservationId, "reservation-1");
});
