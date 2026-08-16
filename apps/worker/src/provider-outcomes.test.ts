import assert from "node:assert/strict";
import test from "node:test";
import { createDevelopmentProvider } from "./development-provider.js";
import { classifyProviderError, ProviderError } from "./provider-outcomes.js";

const job = { id: "job-1", tenantId: "tenant-1", kind: "feedback" as const, channel: "email" as const, idempotencyKey: "tenant-1:feedback:campaign:c:v1", scheduledFor: new Date(), status: "claimed" as const, bookingId: null, customerId: "customer-1" };

test("development provider emits a normalized receipt", async () => {
  let receipt: { outcome: string; idempotencyKey: string } | undefined;
  await createDevelopmentProvider((value) => { receipt = value; }).send({ job, idempotencyKey: job.idempotencyKey });
  assert.equal(receipt?.outcome, "sent");
  assert.equal(receipt?.idempotencyKey, job.idempotencyKey);
});

test("classifies transient and permanent provider failures", () => {
  assert.equal(classifyProviderError(new ProviderError("timeout", true)), "retryable");
  assert.equal(classifyProviderError(new ProviderError("invalid recipient", false)), "permanent_failure");
  assert.equal(classifyProviderError(new Error("unknown")), "retryable");
});
