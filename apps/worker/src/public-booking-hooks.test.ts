import assert from "node:assert/strict";
import test from "node:test";
import { createPublicBookingHooks, type PublicBookingHookExecutor } from "./public-booking-hooks.js";

test("maps a confirmed public booking into reminder outbox planning after commit", async () => {
  const calls: string[] = [];
  const jobs: unknown[] = [];
  const settings = { tenantId: "tenant-1", timezone: "Africa/Nairobi", remindersEnabled: true, feedbackEnabled: true, defaultFeedbackFrequencyDays: 30, bookingChangePolicy: { rescheduleEnabled: true, cancellationEnabled: true, minimumNoticeMinutes: 0 }, reminderRules: [{ id: "rule-1", enabled: true, minutesBefore: 60, channels: ["email"] as const, quietHoursStart: null, quietHoursEnd: null, frequencyCapHours: 24 }] };
  const hooks = createPublicBookingHooks({
    withTenantTransaction: async (_tenantId, work) => { calls.push("begin"); const result = await work({} as PublicBookingHookExecutor); calls.push("commit"); return result; },
    readSettings: async () => settings,
    enqueue: async (_executor, job) => { calls.push("enqueue"); jobs.push(job); },
    cancel: async () => 0,
  });
  await hooks.onConfirmed({ booking: { id: "booking-1", tenantId: "tenant-1", customerId: "customer-1", serviceName: "Consultation", startsAt: new Date(Date.now() + 3_600_000), endsAt: new Date(Date.now() + 5_400_000), status: "scheduled" }, contactMethodId: "contact-1", contactChannels: ["email"] });
  assert.deepEqual(calls, ["begin", "enqueue", "commit"]);
  assert.equal(jobs.length, 1);
});

test("does not invent verification delivery when no issuer is composed", async () => {
  let transactions = 0;
  const hooks = createPublicBookingHooks({
    withTenantTransaction: async (_tenantId, work) => { transactions += 1; return work({} as PublicBookingHookExecutor); },
    readSettings: async () => null,
    enqueue: async () => {},
    cancel: async () => 0,
  });
  await hooks.onContactCaptured({ tenantId: "tenant-1", contactMethodId: "contact-1" });
  assert.equal(transactions, 0);
});
test("replans reminders and cancels stale work for public manage actions", async () => {
  const events: string[] = [];
  const settings = { tenantId: "tenant-1", timezone: "Africa/Nairobi", remindersEnabled: true, feedbackEnabled: true, defaultFeedbackFrequencyDays: 30, bookingChangePolicy: { rescheduleEnabled: true, cancellationEnabled: true, minimumNoticeMinutes: 0 }, reminderRules: [{ id: "rule-1", enabled: true, minutesBefore: 60, channels: ["email"] as const, quietHoursStart: null, quietHoursEnd: null, frequencyCapHours: 24 }] };
  const hooks = createPublicBookingHooks({ withTenantTransaction: async (_tenantId, work) => work({} as PublicBookingHookExecutor), readSettings: async () => settings, enqueue: async () => { events.push("enqueue"); }, cancel: async () => { events.push("cancel"); return 1; } });
  const booking = { id: "booking-1", tenantId: "tenant-1", customerId: "customer-1", serviceName: "Consultation", startsAt: new Date(Date.now() + 3_600_000), endsAt: new Date(Date.now() + 5_400_000), status: "scheduled" as const };
  await hooks.onRescheduled({ booking });
  await hooks.onCancelled({ booking: { ...booking, status: "cancelled" } });
  assert.deepEqual(events, ["cancel", "enqueue", "cancel"]);
});

test("composes contact capture with the existing verification issuer", async () => {
  const issued: string[] = [];
  const hooks = createPublicBookingHooks({
    withTenantTransaction: async (_tenantId, work) => work({} as PublicBookingHookExecutor),
    readSettings: async () => null,
    enqueue: async () => {},
    cancel: async () => 0,
  }, () => ({ issue: async ({ contactMethodId }) => { issued.push(contactMethodId); return { challengeId: "challenge-1", expiresAt: new Date() }; } }));
  await hooks.onContactCaptured({ tenantId: "tenant-1", contactMethodId: "contact-1" });
  assert.deepEqual(issued, ["contact-1"]);
});
