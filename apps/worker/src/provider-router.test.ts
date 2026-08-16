import assert from "node:assert/strict";
import test from "node:test";
import { createProviderRouter } from "./provider-router.js";

const job = { id: "job-1", tenantId: "tenant-1", kind: "reminder" as const, channel: "sms" as const, idempotencyKey: "tenant-1:reminder:c:r:b", scheduledFor: new Date(), status: "claimed" as const, bookingId: "booking-1", customerId: "customer-1" };

test("routes a job to its channel with the stable idempotency key", async () => {
  let received = "";
  await createProviderRouter({ sms: { send: async ({ idempotencyKey }) => { received = idempotencyKey; } } }).send(job);
  assert.equal(received, job.idempotencyKey);
});

test("fails closed when a channel provider is not configured", async () => {
  await assert.rejects(() => createProviderRouter({}).send(job), /No provider configured/);
});

test("can compose feedback capability issuance into the provider router", async () => {
  let feedbackUrl = "";
  const router = createProviderRouter({ sms: { send: async ({ job }) => { feedbackUrl = job.feedbackUrl ?? ""; } } }, { feedback: { executor: { query: async <T>() => [{ capabilityId: "cap-1", tenantId: "tenant-1", campaignId: "campaign-1", templateVersion: 1, customerId: "customer-1", expiresAt: new Date(), sourceJobId: "job-1" }] as T[] }, publicBaseUrl: "https://booking.example" } });
  await router.send({ ...job, kind: "feedback", bookingId: null, campaignId: "campaign-1", templateVersion: 1, feedbackExpiresAt: new Date(Date.now() + 60_000) });
  assert.equal(feedbackUrl, "https://booking.example/feedback.html?capability=cap-1");
});
