import assert from "node:assert/strict";
import test from "node:test";
import { runCommunicationBatch } from "./communication-worker.js";

const row = { id: "job-1", tenant_id: "tenant-1", kind: "reminder" as const, channel: "sms" as const, idempotency_key: "tenant-1:reminder:c:r:b", scheduled_for: new Date("2026-08-12T10:00:00Z"), status: "claimed" as const, booking_id: "booking-1", customer_id: "customer-1" };

test("sends due jobs and records suppressed jobs without provider delivery", async () => {
  const completed: string[] = [];
  const executor = { query: async <T>(sql: string) => sql.startsWith("UPDATE communication_outbox SET status = 'claimed'") ? [row] as T[] : (completed.push(sql), [{ id: "job-1" }] as T[]) };
  let sends = 0;
  const result = await runCommunicationBatch(executor, { send: async () => { sends += 1; } }, { limit: 10, isSuppressed: async () => true });
  assert.deepEqual(result, { claimed: 1, sent: 0, failed: 0, suppressed: 1 });
  assert.equal(sends, 0);
  assert.equal(completed.length, 1);
});

test("records provider failures as failed jobs", async () => {
  const executor = { query: async <T>(sql: string) => sql.startsWith("UPDATE communication_outbox SET status = 'claimed'") ? [row] as T[] : [{ id: "job-1" }] as T[] };
  const result = await runCommunicationBatch(executor, { send: async () => { throw new Error("provider unavailable"); } }, { limit: 1 });
  assert.equal(result.failed, 1);
});

test("resolves the current recipient in memory before provider delivery", async () => {
  const executor = { query: async <T>(sql: string) => sql.startsWith("UPDATE communication_outbox SET status = 'claimed'") ? [row] as T[] : [{ id: "job-1" }] as T[] };
  let recipient = "";
  const result = await runCommunicationBatch(executor, { send: async (job) => { recipient = job.recipient ?? ""; } }, { limit: 1, resolveRecipient: async () => "+254700000000" });
  assert.equal(result.sent, 1);
  assert.equal(recipient, "+254700000000");
});

test("suppresses a claimed job when no current recipient is available", async () => {
  const executor = { query: async <T>(sql: string) => sql.startsWith("UPDATE communication_outbox SET status = 'claimed'") ? [row] as T[] : [{ id: "job-1" }] as T[] };
  let sends = 0;
  const result = await runCommunicationBatch(executor, { send: async () => { sends += 1; } }, { limit: 1, resolveRecipient: async () => null });
  assert.deepEqual(result, { claimed: 1, sent: 0, failed: 0, suppressed: 1 });
  assert.equal(sends, 0);
});
