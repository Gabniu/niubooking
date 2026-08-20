import assert from "node:assert/strict";
import test from "node:test";
import type { CommunicationJob } from "@bookingapp/domain";
import { createDatabaseRecipientResolver, createWorkerRuntime } from "./worker-runtime.js";
import { createGtfsRefreshTask } from "./gtfs-refresh.js";

const row = { id: "job-1", tenant_id: "tenant-1", kind: "reminder" as const, channel: "sms" as const, idempotency_key: "key", scheduled_for: new Date(), status: "claimed" as const, booking_id: "booking-1", customer_id: "customer-1" };

test("runs one worker tick and updates health counters", async () => {
  const executor = { query: async <T>(sql: string) => sql.startsWith("UPDATE communication_outbox SET status = 'claimed'") ? [row] as T[] : [{ id: "job-1" }] as T[] };
  const runtime = createWorkerRuntime(executor, { send: async () => {} }, ["sms"]);
  const health = await runtime.tick(new Date("2026-08-12T12:00:00Z"));
  assert.equal(health.status, "ready");
  assert.equal(health.counters.sent, 1);
});

test("health is not-ready before a configured provider exists", () => {
  const executor = { query: async <T>() => [] as T[] };
  assert.equal(createWorkerRuntime(executor, { send: async () => {} }, []).health().status, "not_ready");
});

test("passes recipient resolution into the worker tick", async () => {
  const executor = { query: async <T>(sql: string) => sql.startsWith("UPDATE communication_outbox SET status = 'claimed'") ? [row] as T[] : [{ id: "job-1" }] as T[] };
  let recipient = "";
  const runtime = createWorkerRuntime(executor, { send: async (job) => { recipient = job.recipient ?? ""; } }, ["sms"], 25, { resolveRecipient: async () => "+254700000000" });
  await runtime.tick();
  assert.equal(recipient, "+254700000000");
});

test("creates a database-backed recipient resolver for runtime composition", async () => {
  const resolver = createDatabaseRecipientResolver({ query: async <T>() => [{ destination: "person@example.test" }] as T[] });
  const job = { id: "job-1", tenantId: "tenant-1", kind: "reminder" as const, channel: "email" as const, idempotencyKey: "key", scheduledFor: new Date(), status: "claimed" as const, bookingId: "booking-1", customerId: "customer-1" } satisfies CommunicationJob;
  assert.equal(await resolver(job), "person@example.test");
});

test("runs a bounded GTFS refresh task and exposes its health without leaking feed data", async () => {
  const executor = { query: async <T>(sql: string) => sql.startsWith("UPDATE communication_outbox SET status = 'claimed'") ? [] as T[] : [] as T[] };
  const task = createGtfsRefreshTask({ listTargets: async () => [{ publicSlug: "city-feed" }], refreshTarget: async () => ({ entityCount: 3 }) });
  const runtime = createWorkerRuntime(executor, { send: async () => {} }, ["sms"], 25, { gtfsRealtimeRefresh: task });
  const health = await runtime.tick(new Date("2026-08-20T10:00:00Z"));
  assert.equal(health.gtfsRealtime?.status, "healthy"); assert.equal(health.gtfsRealtime?.refreshedCount, 1); assert.equal("publicSlug" in health, false);
});
