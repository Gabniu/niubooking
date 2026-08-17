import assert from "node:assert/strict";
import test from "node:test";
import { createPublicCommunicationHooks } from "./public-communication-hooks.js";
import type { SqlExecutor } from "./tenant-membership.js";

const settings = { tenantId: "tenant-1", timezone: "UTC", remindersEnabled: true, feedbackEnabled: true, defaultFeedbackFrequencyDays: 30, bookingChangePolicy: { rescheduleEnabled: true, cancellationEnabled: true, minimumNoticeMinutes: 0 }, reminderRules: [{ id: "rule-1", enabled: true, minutesBefore: 60, channels: ["sms"] as const, quietHoursStart: null, quietHoursEnd: null, frequencyCapHours: 24 }] };
const booking = { id: "booking-1", tenantId: "tenant-1", customerId: "customer-1", serviceName: "Consultation", startsAt: new Date("2030-08-12T12:00:00Z"), endsAt: new Date("2030-08-12T13:00:00Z"), status: "scheduled" as const };

function persistence(events: string[]) {
  return { withTenantTransaction: async <T>(_tenantId: string, work: (executor: SqlExecutor) => Promise<T>) => work({ query: async () => [] }), readSettings: async () => settings, enqueue: async () => { events.push("enqueue"); }, cancelBooking: async () => { events.push("cancel-booking"); return 1; }, cancelOccurrence: async () => { events.push("cancel-occurrence"); return 1; } };
}

test("re-scheduling cancels stale reminders before queuing the new plan", async () => {
  const events: string[] = [];
  const hooks = createPublicCommunicationHooks(persistence(events));
  await hooks.onRescheduled({ booking });
  assert.deepEqual(events, ["cancel-booking", "enqueue"]);
});

test("confirmed occurrence reservations enqueue reminders after commit", async () => {
  const events: string[] = [];
  const hooks = createPublicCommunicationHooks(persistence(events));
  await hooks.onOccurrenceReserved({ reservation: { id: "reservation-1", tenantId: "tenant-1", occurrenceId: "occurrence-1", customerId: "customer-1", quantity: 1, status: "confirmed" }, occurrence: { id: "occurrence-1", tenantId: "tenant-1", serviceId: "service-1", label: "Morning trip", startsAt: booking.startsAt, endsAt: booking.endsAt, status: "open", capacity: 20, reservedQuantity: 1 }, contactChannels: ["sms"] });
  assert.deepEqual(events, ["enqueue"]);
});

test("terminal occurrence status cancels only that reservation's reminders", async () => {
  const events: string[] = [];
  const hooks = createPublicCommunicationHooks(persistence(events));
  await hooks.onOccurrenceReservationStatusChanged({ reservation: { id: "reservation-1", tenantId: "tenant-1", occurrenceId: "occurrence-1", customerId: "customer-1", quantity: 1, status: "cancelled" }, actorId: "user-1" });
  assert.deepEqual(events, ["cancel-occurrence"]);
});
