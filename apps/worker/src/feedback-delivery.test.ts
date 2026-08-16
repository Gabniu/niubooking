import assert from "node:assert/strict";
import test from "node:test";
import { createFeedbackDeliveryProvider } from "./feedback-delivery.js";

test("issues a capability and passes a public feedback URL to the channel provider", async () => {
  let payload = "";
  await createFeedbackDeliveryProvider({ query: async <T>() => [{ capabilityId: "cap-1", tenantId: "tenant-1", campaignId: "campaign-1", templateVersion: 2, customerId: "customer-1", expiresAt: new Date(), sourceJobId: "job-1" }] as T[] }, { publicBaseUrl: "https://booking.example" }, { send: async ({ job }) => { payload = job.feedbackUrl ?? ""; } }).send({ job: { id: "job-1", tenantId: "tenant-1", kind: "feedback", channel: "sms", idempotencyKey: "key", scheduledFor: new Date(), status: "claimed", bookingId: null, customerId: "customer-1", campaignId: "campaign-1", templateVersion: 2, feedbackExpiresAt: new Date(Date.now() + 86_400_000) }, idempotencyKey: "key" });
  assert.equal(payload, "https://booking.example/feedback.html?capability=cap-1");
});

test("fails closed when a feedback job has no campaign metadata", async () => {
  await assert.rejects(() => createFeedbackDeliveryProvider({ query: async <T>() => [] as T[] }, { publicBaseUrl: "https://booking.example" }, { send: async () => undefined }).send({ job: { id: "job-1", tenantId: "tenant-1", kind: "feedback", channel: "sms", idempotencyKey: "key", scheduledFor: new Date(), status: "claimed", bookingId: null, customerId: "customer-1" }, idempotencyKey: "key" }), /metadata/);
});
