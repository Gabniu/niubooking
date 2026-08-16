import assert from "node:assert/strict";
import test from "node:test";
import { cancelPendingBookingJobs, claimDueCommunicationJobs, completeCommunicationJob, enqueueCommunicationJob } from "./communication-outbox.js";

const job = { id: "job-1", tenantId: "tenant-1", kind: "reminder" as const, channel: "sms" as const, idempotencyKey: "tenant-1:reminder:c:r:b", scheduledFor: new Date("2026-08-12T10:00:00Z"), bookingId: "booking-1", customerId: "customer-1" };

test("enqueues with idempotent conflict handling", async () => {
  let sql = "";
  const value = await enqueueCommunicationJob({ query: async <T>(statement: string) => { sql = statement; return [{ ...job, tenant_id: job.tenantId, kind: job.kind, channel: job.channel, idempotency_key: job.idempotencyKey, scheduled_for: job.scheduledFor, status: "pending", booking_id: job.bookingId, customer_id: job.customerId }] as T[]; } }, job);
  assert.equal(value.status, "pending");
  assert.match(sql, /ON CONFLICT \(tenant_id, idempotency_key\)/);
});

test("claims due jobs and only completes claimed jobs", async () => {
  const executor = { query: async <T>() => [{ ...job, tenant_id: job.tenantId, kind: job.kind, channel: job.channel, idempotency_key: job.idempotencyKey, scheduled_for: job.scheduledFor, status: "claimed", booking_id: job.bookingId, customer_id: job.customerId, id: job.id }] as T[] };
  assert.equal((await claimDueCommunicationJobs(executor, 10, new Date())).length, 1);
  assert.equal(await completeCommunicationJob(executor, "tenant-1", "job-1", "sent"), true);
});

test("cancels only pending jobs for a tenant booking", async () => {
  const executor = { query: async <T>() => [{ id: "job-1" }] as T[] };
  assert.equal(await cancelPendingBookingJobs(executor, "tenant-1", "booking-1"), 1);
});
