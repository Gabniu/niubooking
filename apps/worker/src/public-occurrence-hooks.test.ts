// Ownership: post-commit occurrence communication composition proof.

import assert from "node:assert/strict";
import test from "node:test";
import { createPublicOccurrenceHooks, type PublicOccurrenceHookPersistence } from "./public-occurrence-hooks.js";

test("maps a committed occurrence reservation into reminder outbox work", async () => {
  const calls: string[] = [];
  const jobs: unknown[] = [];
  const settings = { tenantId: "tenant-1", timezone: "UTC", remindersEnabled: true, feedbackEnabled: true, defaultFeedbackFrequencyDays: 30, bookingChangePolicy: { rescheduleEnabled: true, cancellationEnabled: true, minimumNoticeMinutes: 0 }, reminderRules: [{ id: "rule-1", enabled: true, minutesBefore: 60, channels: ["email"] as const, quietHoursStart: null, quietHoursEnd: null, frequencyCapHours: 24 }] };
  const persistence: PublicOccurrenceHookPersistence = { withTenantTransaction: async (_tenantId, work) => { calls.push("begin"); const value = await work({} as never); calls.push("commit"); return value; }, readSettings: async () => settings, enqueue: async (_executor, job) => { calls.push("enqueue"); jobs.push(job); }, cancelOccurrence: async () => 0 };
  const hooks = createPublicOccurrenceHooks(persistence);
  await hooks.onReserved({ reservation: { id: "reservation-1", tenantId: "tenant-1", occurrenceId: "occ-1", customerId: "customer-1", quantity: 1, status: "confirmed" }, occurrence: { id: "occ-1", tenantId: "tenant-1", serviceId: "service-1", label: "Morning class", startsAt: new Date("2030-08-12T12:00:00Z"), endsAt: new Date("2030-08-12T13:00:00Z"), status: "open", capacity: 10, reservedQuantity: 1 }, contactChannels: ["email"] });
  assert.deepEqual(calls, ["begin", "enqueue", "commit"]);
  assert.equal(jobs.length, 1);
  assert.equal((jobs[0] as { reservationId: string }).reservationId, "reservation-1");
});

test("does not invent occurrence communication when tenant settings are absent", async () => {
  let enqueued = 0;
  const hooks = createPublicOccurrenceHooks({ withTenantTransaction: async (_tenantId, work) => work({} as never), readSettings: async () => null, enqueue: async () => { enqueued += 1; }, cancelOccurrence: async () => 0 });
  await hooks.onReserved({ reservation: { id: "reservation-1", tenantId: "tenant-1", occurrenceId: "occ-1", customerId: "customer-1", quantity: 1, status: "confirmed" }, occurrence: { id: "occ-1", tenantId: "tenant-1", serviceId: "service-1", label: "Class", startsAt: new Date("2030-08-12T12:00:00Z"), endsAt: new Date("2030-08-12T13:00:00Z"), status: "open", capacity: null, reservedQuantity: 1 }, contactChannels: ["email"] });
  assert.equal(enqueued, 0);
});

test("cancels only the changed occurrence reservation reminders after commit", async () => {
  const calls: string[] = [];
  const hooks = createPublicOccurrenceHooks({ withTenantTransaction: async (_tenantId, work) => { calls.push("begin"); const value = await work({} as never); calls.push("commit"); return value; }, readSettings: async () => null, enqueue: async () => {}, cancelOccurrence: async (_executor, tenantId, occurrenceId, reservationId) => { calls.push(`${tenantId}:${occurrenceId}:${reservationId}`); return 2; } });
  await hooks.onStatusChanged({ reservation: { id: "reservation-1", tenantId: "tenant-1", occurrenceId: "occ-1", customerId: "customer-1", quantity: 1, status: "cancelled" }, actorId: "user-1" });
  assert.deepEqual(calls, ["begin", "tenant-1:occ-1:reservation-1", "commit"]);
});
