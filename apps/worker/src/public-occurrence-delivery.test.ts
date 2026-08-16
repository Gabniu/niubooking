// Ownership: provider-delivery smoke proof for an occurrence reservation.

import assert from "node:assert/strict";
import test from "node:test";
import type { CommunicationJobDraft } from "@bookingapp/domain";
import { createPublicOccurrenceHooks } from "./public-occurrence-hooks.js";
import { createDevelopmentProvider } from "./development-provider.js";
import { createProviderRouter } from "./provider-router.js";
import { runCommunicationBatch } from "./communication-worker.js";

test("delivers an occurrence reminder through the provider boundary", async () => {
  const settings = { tenantId: "tenant-1", timezone: "UTC", remindersEnabled: true, feedbackEnabled: true, defaultFeedbackFrequencyDays: 30, bookingChangePolicy: { rescheduleEnabled: true, cancellationEnabled: true, minimumNoticeMinutes: 0 }, reminderRules: [{ id: "rule-1", enabled: true, minutesBefore: 60, channels: ["email"] as const, quietHoursStart: null, quietHoursEnd: null, frequencyCapHours: 24 }] };
  const queued: CommunicationJobDraft[] = [];
  await createPublicOccurrenceHooks({ withTenantTransaction: async (_tenantId, work) => work({} as never), readSettings: async () => settings, enqueue: async (_executor, job) => { queued.push(job); }, cancelOccurrence: async () => 0 }).onReserved({ reservation: { id: "reservation-1", tenantId: "tenant-1", occurrenceId: "occ-1", customerId: "customer-1", quantity: 1, status: "confirmed" }, occurrence: { id: "occ-1", tenantId: "tenant-1", serviceId: "service-1", label: "Morning class", startsAt: new Date("2030-08-12T12:00:00Z"), endsAt: new Date("2030-08-12T13:00:00Z"), status: "open", capacity: 10, reservedQuantity: 1 }, contactChannels: ["email"] });
  assert.equal(queued.length, 1);
  const draft = queued[0];
  assert.ok(draft);
  const row = { ...draft, tenant_id: draft.tenantId, kind: draft.kind, channel: draft.channel, idempotency_key: draft.idempotencyKey, scheduled_for: draft.scheduledFor, status: "claimed" as const, booking_id: null, occurrence_id: draft.occurrenceId, reservation_id: draft.reservationId, customer_id: draft.customerId };
  const completed: string[] = [];
  const executor = { query: async <T>(sql: string) => sql.startsWith("UPDATE communication_outbox SET status = 'claimed'") ? [row] as T[] : (completed.push(sql), [{ id: draft.id }] as T[]) };
  const deliveries: string[] = [];
  const provider = createProviderRouter({ email: createDevelopmentProvider((delivery) => deliveries.push(`${delivery.idempotencyKey}:${delivery.jobId}`)) });
  const result = await runCommunicationBatch(executor, provider, { limit: 1, resolveRecipient: async () => "alex@example.com", now: new Date("2030-08-12T10:01:00Z") });
  assert.deepEqual(result, { claimed: 1, sent: 1, failed: 0, suppressed: 0 });
  assert.equal(deliveries[0], `${draft.idempotencyKey}:${draft.id}`);
  assert.equal(completed.length, 1);
});
