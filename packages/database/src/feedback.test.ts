import assert from "node:assert/strict";
import test from "node:test";
import { issueFeedbackCapability, submitFeedbackResponse } from "./feedback.js";

test("issues one opaque capability per feedback delivery job", async () => {
  let sql = "";
  const capability = await issueFeedbackCapability({ query: async <T>(statement: string) => { sql = statement; return [{ capabilityId: "cap-1", tenantId: "tenant-1", campaignId: "campaign-1", templateVersion: 2, customerId: "customer-1", expiresAt: new Date(), sourceJobId: "job-1" }] as T[]; } }, { jobId: "job-1", tenantId: "tenant-1", campaignId: "campaign-1", templateVersion: 2, customerId: "customer-1", expiresAt: new Date() });
  assert.equal(capability.capabilityId, "cap-1");
  assert.match(sql, /ON CONFLICT \(source_job_id\)/);
});

test("submits through an unused, unexpired capability with an idempotent insert", async () => {
  let sql = "";
  const executor = { query: async <T>(statement: string) => { sql = statement; return [{ capability_id: "cap-1" }] as T[]; } };
  const accepted = await submitFeedbackResponse(executor, { capabilityId: "cap-1", campaignId: "campaign-1", templateVersion: 1, customerId: "customer-1", answers: { rating: 5 }, submittedAt: new Date() });
  assert.equal(accepted, true);
  assert.match(sql, /used_at IS NULL/);
});

test("reports duplicate submission as rejected", async () => {
  const accepted = await submitFeedbackResponse({ query: async <T>() => [] as T[] }, { capabilityId: "cap-1", campaignId: "campaign-1", templateVersion: 1, customerId: "customer-1", answers: {}, submittedAt: new Date() });
  assert.equal(accepted, false);
});
