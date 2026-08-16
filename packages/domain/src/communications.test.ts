import assert from "node:assert/strict";
import test from "node:test";
import { isFeedbackEligible, reminderAt, type FeedbackCampaign } from "./communications.js";

const campaign: FeedbackCampaign = { id: "campaign-1", tenantId: "tenant-1", enabled: true, audience: "any-client", templateVersion: 1, frequencyCapDays: 7, expiresAfterDays: 14 };

test("allows general feedback for a client without an appointment", () => {
  assert.equal(isFeedbackEligible({ campaign, hasCompletedAppointment: false, optedOut: false, lastSentAt: null, now: new Date() }), true);
});

test("enforces appointment audience, opt-out, and frequency cap", () => {
  assert.equal(isFeedbackEligible({ campaign: { ...campaign, audience: "completed-appointment" }, hasCompletedAppointment: false, optedOut: false, lastSentAt: null, now: new Date() }), false);
  assert.equal(isFeedbackEligible({ campaign, hasCompletedAppointment: true, optedOut: true, lastSentAt: null, now: new Date() }), false);
  assert.equal(isFeedbackEligible({ campaign, hasCompletedAppointment: true, optedOut: false, lastSentAt: new Date("2026-08-10"), now: new Date("2026-08-12") }), false);
});

test("calculates a positive reminder offset", () => {
  const at = reminderAt(new Date("2026-08-12T12:00:00Z"), { id: "r-1", enabled: true, minutesBefore: 120, channels: ["email"], quietHoursStart: null, quietHoursEnd: null, frequencyCapHours: 24 });
  assert.equal(at.toISOString(), "2026-08-12T10:00:00.000Z");
});
