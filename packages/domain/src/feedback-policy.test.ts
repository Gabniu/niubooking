import assert from "node:assert/strict";
import test from "node:test";
import { campaignFromDraft, validateFeedbackCampaign } from "./feedback-policy.js";

const draft = { id: "campaign-1", tenantId: "tenant-1", enabled: true, audience: "any-client" as const, templateVersion: 1, frequencyCapDays: 30, expiresAfterDays: 14 };

test("accepts a safe organization campaign draft", () => {
  assert.deepEqual(validateFeedbackCampaign(draft), []);
  assert.equal(campaignFromDraft(draft).tenantId, "tenant-1");
});

test("rejects unsafe expiry and invalid caps", () => {
  assert.match(validateFeedbackCampaign({ ...draft, audience: "completed-appointment", expiresAfterDays: 91 })[0] ?? "", /expire/);
  assert.equal(validateFeedbackCampaign({ ...draft, frequencyCapDays: 0 }).length, 1);
});
